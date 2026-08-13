#import "CosimoAUv3HostHarness.h"

#import <AVFoundation/AVFoundation.h>
#import <AudioToolbox/AudioToolbox.h>
#import <CoreAudioKit/AUViewController.h>
#import <WebKit/WebKit.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <memory>
#include <vector>

#include <mach/mach_time.h>

#ifndef COSIMO_HOST_PLUGIN_SUBTYPE
#define COSIMO_HOST_PLUGIN_SUBTYPE "CmDv"
#endif

#ifndef COSIMO_HOST_PLUGIN_MANUFACTURER
#define COSIMO_HOST_PLUGIN_MANUFACTURER "Manu"
#endif

static NSString * const CosimoHostHarnessErrorDomain = @"CosimoHostHarnessError";
static NSString * const CosimoPrimaryParameterIdentifier = @"wavetablePosition";
static NSString * const CosimoTableSelectParameterIdentifier = @"wavetableSelect";
static const float CosimoStateVerificationTolerance = 0.001f;
static const NSTimeInterval CosimoStateVerificationTimeoutSeconds = 5.0;
static const NSTimeInterval CosimoFirstNoteOffSeconds = 1.2;
static const NSTimeInterval CosimoSecondNoteOnSeconds = 1.8;
static const NSTimeInterval CosimoSecondNoteOffSeconds = 3.0;
static const NSTimeInterval CosimoNoteCaptureDurationSeconds = 4.2;
static const NSInteger CosimoEditorStateCaptureAttempts = 12;
static const NSTimeInterval CosimoEditorStateInitialDelaySeconds = 0.35;
static const NSTimeInterval CosimoEditorStateRetryDelaySeconds = 0.25;
static const double CosimoBenchmarkSampleRate = 48000.0;
static const AVAudioFrameCount CosimoBenchmarkBufferFrames = 128;
static const NSUInteger CosimoBenchmarkVoiceCount = 16;
static const NSUInteger CosimoBenchmarkMaximumGapSamples = 65536;
static const NSTimeInterval CosimoNeutralSourceSettleSeconds = 0.05;
static const NSTimeInterval CosimoThermalCooldownMinimumSeconds = 30.0;
static const NSTimeInterval CosimoThermalCooldownPollSeconds = 5.0;
static const NSTimeInterval CosimoThermalCooldownTimeoutSeconds = 900.0;
static const NSTimeInterval CosimoThermalRestartSettleSeconds = 0.5;
static NSString * const CosimoBenchmarkProfileParameter = @"cosimoBenchmarkProfile";
static NSString * const CosimoBenchmarkRuntimeReadyParameter = @"cosimoBenchmarkRuntimeReady";
static NSString * const CosimoBenchmarkRuntimeReadyRequestParameter = @"cosimoBenchmarkRuntimeReadyRequest";
static NSString * const CosimoBenchmarkInstallParameter = @"cosimoBenchmarkInstall";
static NSString * const CosimoBenchmarkInstallStatusParameter = @"cosimoBenchmarkInstallStatus";
static NSString * const CosimoBenchmarkInstallGenerationParameter = @"cosimoBenchmarkInstallGeneration";
static NSString * const CosimoBenchmarkCaptureParameter = @"cosimoBenchmarkCapture";
static NSString * const CosimoBenchmarkCaptureGenerationParameter = @"cosimoBenchmarkCaptureGeneration";
static NSString * const CosimoBenchmarkCaptureStopGenerationParameter = @"cosimoBenchmarkCaptureStopGeneration";
static NSString * const CosimoBenchmarkResultGenerationParameter = @"cosimoBenchmarkResultGeneration";
static NSString * const CosimoBenchmarkResultFieldRequestParameter = @"cosimoBenchmarkResultFieldRequest";
static NSString * const CosimoBenchmarkResultFieldResponseParameter = @"cosimoBenchmarkResultFieldResponse";
static const NSUInteger CosimoBenchmarkInstallFieldCount = 5;
static const NSUInteger CosimoBenchmarkRenderFieldStart = CosimoBenchmarkInstallFieldCount;

static NSArray<NSString *> *CosimoBenchmarkResultFieldIdentifiers()
{
    return @[
        @"acceptedModulationProgramSerial", @"installedVoiceRouteCount", @"installedMacroVoiceRouteCount",
        @"installedVoiceRackRouteCount", @"installedMacroRackRouteCount",
        @"renderBlockCount", @"capturedRenderSampleCount", @"dspSampleRate", @"audioFrames", @"minimumFrames",
        @"maximumFrames", @"renderLoadPercent", @"p99RenderLoadPercent", @"p999RenderLoadPercent",
        @"maximumRenderLoadPercent", @"deadlineMissCount", @"voiceMask", @"rackEnableMask",
    ];
}

static NSArray<NSNumber *> *CosimoBenchmarkResultFieldScales()
{
    return @[ @100000.0, @624.0, @624.0, @624.0, @624.0,
              @100000.0, @100000.0, @192000.0, @10000000.0, @4096.0, @4096.0, @200.0,
              @200.0, @200.0, @1000.0, @10000.0, @65535.0, @255.0 ];
}

struct CosimoModulationPhaseCapture
{
    uint64_t callbackCount = 0;
    uint64_t audioFrames = 0;
    uint64_t sampleCount = 0;
    uint64_t nonFiniteSampleCount = 0;
    uint64_t clippedSampleCount = 0;
    uint64_t tapArrivalGapOver125PercentCount = 0;
    uint64_t sampleTimeDiscontinuityCount = 0;
    AVAudioFrameCount minimumBufferFrames = UINT32_MAX;
    AVAudioFrameCount maximumBufferFrames = 0;
    double energy = 0.0;
    double peak = 0.0;
    double maximumTapArrivalGapRatio = 0.0;
    uint64_t previousTapArrivalTime = 0;
    AVAudioFramePosition previousSampleTime = -1;
    AVAudioFrameCount previousFrameCount = 0;
    std::array<double, CosimoBenchmarkMaximumGapSamples> gapRatios {};
    NSUInteger recordedGapCount = 0;
};

static double CosimoTimeIntervalSeconds (uint64_t start, uint64_t end)
{
    static mach_timebase_info_data_t timebase = []
    {
        mach_timebase_info_data_t result {};
        mach_timebase_info (&result);
        return result;
    }();
    return (double) (end - start) * (double) timebase.numer / (double) timebase.denom / 1.0e9;
}

static NSString * CosimoThermalStateName (NSProcessInfoThermalState state)
{
    switch (state)
    {
        case NSProcessInfoThermalStateNominal: return @"nominal";
        case NSProcessInfoThermalStateFair: return @"fair";
        case NSProcessInfoThermalStateSerious: return @"serious";
        case NSProcessInfoThermalStateCritical: return @"critical";
    }
    return @"unknown";
}

static NSError * CosimoMakeError (NSInteger code, NSString *description)
{
    return [NSError errorWithDomain:CosimoHostHarnessErrorDomain
                               code:code
                           userInfo:@{ NSLocalizedDescriptionKey: description }];
}

static OSType CosimoFourCC (const char code[5])
{
    return ((uint32_t) code[0] << 24)
         | ((uint32_t) code[1] << 16)
         | ((uint32_t) code[2] << 8)
         | ((uint32_t) code[3]);
}

static NSString * CosimoStringFromFourCC (OSType value)
{
    char code[5];
    code[0] = (char) ((value >> 24) & 0xff);
    code[1] = (char) ((value >> 16) & 0xff);
    code[2] = (char) ((value >> 8) & 0xff);
    code[3] = (char) (value & 0xff);
    code[4] = '\0';
    return [NSString stringWithUTF8String:code] ?: @"????";
}

static AudioComponentDescription CosimoComponentDescription()
{
    AudioComponentDescription description {};
    description.componentType = kAudioUnitType_MusicDevice;
    description.componentSubType = CosimoFourCC (COSIMO_HOST_PLUGIN_SUBTYPE);
    description.componentManufacturer = CosimoFourCC (COSIMO_HOST_PLUGIN_MANUFACTURER);
    return description;
}

@interface CosimoAUv3HostHarness ()

@property (nonatomic, weak) UIViewController *hostViewController;
@property (nonatomic, weak) UIView *editorContainerView;
@property (nonatomic, strong) AVAudioUnitComponent *component;
@property (nonatomic, strong) AVAudioEngine *engine;
@property (nonatomic, strong) AVAudioUnit *instrumentUnit;
@property (nonatomic, strong) UIViewController *editorController;
@property (nonatomic, strong) NSDictionary<NSString *, id> *lastDiscoverySummary;
@property (nonatomic, strong) NSArray<NSDictionary<NSString *, id> *> *parameterSnapshot;
@property (nonatomic, assign) uint64_t benchmarkCaptureBaselineGeneration;
@property (nonatomic, assign) BOOL benchmarkRuntimeReadyRequestToggle;
@property (nonatomic, strong) NSDate *benchmarkRuntimeReadyLastSyncRequest;

- (void)captureEditorStateAfterDelay:(NSTimeInterval)delay
                    remainingAttempts:(NSInteger)remainingAttempts
                           completion:(CosimoHostResultBlock)completion;
- (BOOL)hostPageInspectionIsReady:(NSDictionary<NSString *, id> * _Nullable)hostPageResult;
- (void)beginModulationBenchmarkCaptureWithCompletion:(CosimoHostResultBlock)completion;
- (void)prepareNeutralModulationBenchmarkSourcesWithCompletion:(CosimoHostResultBlock)completion;
- (void)finishModulationBenchmarkCaptureWithCompletion:(CosimoHostResultBlock)completion;
- (void)waitForModulationProfileInstallAtIndex:(NSUInteger)profileIndex
                            baselineGeneration:(uint64_t)baselineGeneration
                                      deadline:(NSDate *)deadline
                                    completion:(CosimoHostResultBlock)completion;
- (void)waitForModulationRuntimeReadyUntil:(NSDate *)deadline
                                 completion:(CosimoHostResultBlock)completion;
- (void)readCompletedModulationBenchmarkAfterAttempts:(NSInteger)remainingAttempts
                                           completion:(CosimoHostResultBlock)completion;
- (void)readModulationBenchmarkFieldsFromIndex:(NSUInteger)fieldIndex
                                  endingBefore:(NSUInteger)endIndex
                                         values:(NSMutableDictionary<NSString *, NSNumber *> *)values
                                     completion:(CosimoHostResultBlock)completion;
- (void)waitForModulationBenchmarkFieldAtIndex:(NSUInteger)fieldIndex
                                   endingBefore:(NSUInteger)endIndex
                                         values:(NSMutableDictionary<NSString *, NSNumber *> *)values
                              remainingAttempts:(NSInteger)remainingAttempts
                                     completion:(CosimoHostResultBlock)completion;
- (void)waitForModulationBenchmarkCaptureStartedUntil:(NSDate *)deadline
                             baselineCaptureGeneration:(uint64_t)baselineCaptureGeneration
                                            completion:(CosimoHostResultBlock)completion;
- (void)measureStartedModulationPhaseNamed:(NSString *)phaseName
                            durationSeconds:(NSTimeInterval)durationSeconds
                                 completion:(CosimoHostResultBlock)completion;
- (void)coolForModulationMeasurementWithCompletion:(CosimoHostResultBlock)completion;
- (void)waitForSafeThermalStateUntil:(NSDate *)deadline
                           completion:(CosimoHostResultBlock)completion;

@end

@implementation CosimoAUv3HostHarness

- (instancetype)initWithHostViewController:(UIViewController *)hostViewController
                         editorContainerView:(UIView *)editorContainerView
{
    self = [super init];

    if (self != nil)
    {
        _hostViewController = hostViewController;
        _editorContainerView = editorContainerView;
    }

    return self;
}

- (void)discoverExtensionWithCompletion:(CosimoHostResultBlock)completion
{
    NSArray<AVAudioUnitComponent *> *components = [self matchingCosimoComponents];

    if (components.count == 0)
    {
        completion (nil, CosimoMakeError (10, [self unavailableComponentMessage]));
        return;
    }

    self.component = components.firstObject;
    self.lastDiscoverySummary = @{
        @"matchedComponents": @(components.count),
        @"componentName": self.component.name ?: @"Cosimo Synth",
        @"typeName": self.component.typeName ?: @"",
        @"componentType": CosimoStringFromFourCC (self.component.audioComponentDescription.componentType),
        @"componentSubType": CosimoStringFromFourCC (self.component.audioComponentDescription.componentSubType),
        @"componentManufacturer": CosimoStringFromFourCC (self.component.audioComponentDescription.componentManufacturer),
    };

    completion (self.lastDiscoverySummary, nil);
}

- (void)instantiateExtensionWithCompletion:(CosimoHostResultBlock)completion
{
    if (self.instrumentUnit != nil)
    {
        completion (@{
            @"componentName": self.component.name ?: @"Cosimo Synth",
            @"audioUnitName": self.component.name ?: @"Cosimo Synth",
        }, nil);
        return;
    }

    if (self.component == nil)
    {
        [self instantiateAudioUnitWithDescription:CosimoComponentDescription() completion:^ (AVAudioUnit * _Nullable audioUnit, NSError * _Nullable error)
        {
            if (error != nil)
            {
                [self discoverExtensionWithCompletion:^ (NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable discoverError)
                {
                    completion (nil, error ?: discoverError);
                }];
                return;
            }

            [self finishInstantiatingAudioUnit:audioUnit completion:completion];
        }];

        return;
    }

    [self instantiateAudioUnitWithDescription:self.component.audioComponentDescription completion:^ (AVAudioUnit * _Nullable audioUnit, NSError * _Nullable error)
    {
        if (error != nil || audioUnit == nil)
        {
            completion (nil, error ?: CosimoMakeError (11, @"Could not instantiate the Cosimo Synth AUv3 extension."));
            return;
        }

        [self finishInstantiatingAudioUnit:audioUnit completion:completion];
    }];
}

- (void)setParameterWithIdentifier:(NSString *)identifier
                             value:(float)value
                        completion:(CosimoHostResultBlock)completion
{
    AUParameter *parameter = [self findParameterWithIdentifier:identifier];

    if (parameter == nil)
    {
        completion (nil, CosimoMakeError (13, [NSString stringWithFormat:@"Could not find parameter %@", identifier]));
        return;
    }

    parameter.value = value;

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.15 * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        completion (@{
            @"identifier": identifier,
            @"requestedValue": @(value),
            @"observedValue": @(parameter.value),
        }, nil);
    });
}

- (void)sendTestNoteWithCompletion:(CosimoHostResultBlock)completion
{
    if (self.instrumentUnit == nil || self.engine == nil)
    {
        completion (nil, CosimoMakeError (14, @"Instantiate the AUv3 before sending notes."));
        return;
    }

    AUScheduleMIDIEventBlock midiBlock = self.instrumentUnit.AUAudioUnit.scheduleMIDIEventBlock;

    if (midiBlock == nil)
    {
        completion (nil, CosimoMakeError (15, @"The AUv3 did not provide a MIDI schedule block."));
        return;
    }

    AVAudioMixerNode *mixer = self.engine.mainMixerNode;
    AVAudioFormat *format = [mixer outputFormatForBus:0];
    __block double peakRMS = 0.0;
    __block NSInteger capturedBuffers = 0;

    [mixer removeTapOnBus:0];
    [mixer installTapOnBus:0
                bufferSize:512
                    format:format
                     block:^ (AVAudioPCMBuffer *buffer, AVAudioTime *when)
    {
        if (buffer.floatChannelData == nullptr || buffer.frameLength == 0)
            return;

        capturedBuffers += 1;

        const UInt32 channelCount = buffer.format.channelCount;
        const UInt32 frameLength = buffer.frameLength;
        double energy = 0.0;

        for (UInt32 frame = 0; frame < frameLength; ++frame)
        {
            double sampleTotal = 0.0;

            for (UInt32 channel = 0; channel < channelCount; ++channel)
                sampleTotal += buffer.floatChannelData[channel][frame];

            const double sample = sampleTotal / (double) channelCount;
            energy += sample * sample;
        }

        peakRMS = fmax (peakRMS, sqrt (energy / (double) frameLength));
    }];

    const uint8_t noteOn[] = { 0x90, 60, 96 };
    midiBlock (AUEventSampleTimeImmediate, 0, 3, noteOn);

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (CosimoFirstNoteOffSeconds * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        const uint8_t noteOff[] = { 0x80, 60, 0 };
        midiBlock (AUEventSampleTimeImmediate, 0, 3, noteOff);
    });

    // AUv3 startup on Simulator can occasionally swallow the first note while the
    // extension is still warming up. A second note keeps the smoke focused on
    // "can this instance render audio after launch?" rather than first-event timing.
    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (CosimoSecondNoteOnSeconds * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        const uint8_t secondNoteOn[] = { 0x90, 67, 96 };
        midiBlock (AUEventSampleTimeImmediate, 0, 3, secondNoteOn);
    });

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (CosimoSecondNoteOffSeconds * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        const uint8_t secondNoteOff[] = { 0x80, 67, 0 };
        midiBlock (AUEventSampleTimeImmediate, 0, 3, secondNoteOff);
    });

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (CosimoNoteCaptureDurationSeconds * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [mixer removeTapOnBus:0];
        completion (@{
            @"peakRMS": @(peakRMS),
            @"capturedBuffers": @(capturedBuffers),
        }, nil);
    });
}

- (void)openEditorWithCompletion:(CosimoHostResultBlock)completion
{
    if (self.instrumentUnit == nil)
    {
        completion (nil, CosimoMakeError (16, @"Instantiate the AUv3 before opening the editor."));
        return;
    }

    if (self.editorController != nil)
    {
        [self captureEditorStateWithCompletion:completion];
        return;
    }

    [self.instrumentUnit.AUAudioUnit requestViewControllerWithCompletionHandler:^ (AUViewControllerBase * _Nullable viewController)
    {
        if (viewController == nil)
        {
            dispatch_async (dispatch_get_main_queue(), ^
            {
                completion (nil, CosimoMakeError (17, @"The AUv3 did not return an editor view controller."));
            });
            return;
        }

        dispatch_async (dispatch_get_main_queue(), ^
        {
            self.editorController = (UIViewController *) viewController;
            UIViewController *host = self.hostViewController;
            UIView *container = self.editorContainerView;

            [host addChildViewController:self.editorController];
            self.editorController.view.translatesAutoresizingMaskIntoConstraints = NO;
            [container addSubview:self.editorController.view];
            [NSLayoutConstraint activateConstraints:@[
                [self.editorController.view.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
                [self.editorController.view.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
                [self.editorController.view.topAnchor constraintEqualToAnchor:container.topAnchor],
                [self.editorController.view.bottomAnchor constraintEqualToAnchor:container.bottomAnchor],
            ]];
            [self.editorController didMoveToParentViewController:host];
            [container layoutIfNeeded];
            [self captureEditorStateWithCompletion:completion];
        });
    }];
}

- (void)captureEditorStateWithCompletion:(CosimoHostResultBlock)completion
{
    [self captureEditorStateAfterDelay:CosimoEditorStateInitialDelaySeconds
                     remainingAttempts:CosimoEditorStateCaptureAttempts
                            completion:completion];
}

- (void)captureEditorStateAfterDelay:(NSTimeInterval)delay
                    remainingAttempts:(NSInteger)remainingAttempts
                           completion:(CosimoHostResultBlock)completion
{
    [self collectEditorDOMMetricsAfterDelay:delay
                          remainingAttempts:CosimoEditorStateCaptureAttempts
                                 completion:^(NSDictionary<NSString *,id> * _Nullable debugResult, NSError * _Nullable debugError)
    {
        [self inspectEditorHostPageAfterDelay:0.0
                            remainingAttempts:CosimoEditorStateCaptureAttempts
                                   completion:^(NSDictionary<NSString *,id> * _Nullable hostPageResult, NSError * _Nullable hostPageError)
        {
            NSMutableDictionary<NSString *, id> *result = [[self currentEditorMetrics:YES] mutableCopy];

            if (debugResult != nil)
                result[@"domMetrics"] = debugResult;

            if (debugError != nil)
                result[@"domMetricsError"] = debugError.localizedDescription ?: @"Unknown DOM metrics error";

            if (hostPageResult != nil)
                result[@"hostPage"] = hostPageResult;

            const BOOL hasWebView = [result[@"hasWebView"] boolValue];
            const BOOL hostPageReady = ! hasWebView || [self hostPageInspectionIsReady:hostPageResult];
            NSString *hostPageErrorDescription = hostPageError.localizedDescription ?: @"";

            if (! hostPageReady && remainingAttempts > 0)
            {
                [self captureEditorStateAfterDelay:CosimoEditorStateRetryDelaySeconds
                                 remainingAttempts:remainingAttempts - 1
                                        completion:completion];
                return;
            }

            if (hostPageError != nil)
                result[@"hostPageError"] = hostPageErrorDescription.length > 0 ? hostPageErrorDescription
                                                                               : @"Unknown host page error";

            completion (result, nil);
        }];
    }];
}

- (BOOL)hostPageInspectionIsReady:(NSDictionary<NSString *, id> * _Nullable)hostPageResult
{
    if (hostPageResult == nil)
        return NO;

    NSString *devServerURL = [hostPageResult[@"devServerURL"] isKindOfClass:[NSString class]]
        ? hostPageResult[@"devServerURL"]
        : @"";

    if (devServerURL.length == 0)
        return YES;

    NSString *bootSource = [hostPageResult[@"bootSource"] isKindOfClass:[NSString class]]
        ? hostPageResult[@"bootSource"]
        : @"";

    if ([bootSource isEqualToString:@"devServer"])
        return YES;

    return [hostPageResult[@"devServerProbe"] isKindOfClass:[NSDictionary class]];
}

- (void)inspectEditorHostPageAfterDelay:(NSTimeInterval)delay
                      remainingAttempts:(NSInteger)remainingAttempts
                             completion:(CosimoHostResultBlock)completion
{
    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (delay * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self inspectEditorHostPageWithCompletion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
        {
            if (result != nil || remainingAttempts <= 0)
            {
                completion (result, error);
                return;
            }

            NSString *description = error.localizedDescription ?: @"";

            if ([description containsString:@"did not expose host page inspection yet"])
            {
                [self inspectEditorHostPageAfterDelay:0.25
                                    remainingAttempts:remainingAttempts - 1
                                           completion:completion];
                return;
            }

            completion (nil, error);
        }];
    });
}

- (void)inspectEditorHostPageWithCompletion:(CosimoHostResultBlock)completion
{
    if (self.editorController == nil)
    {
        completion (nil, CosimoMakeError (31, @"The editor is not open."));
        return;
    }

    WKWebView *webView = [self findWebViewInView:self.editorController.view];

    if (webView == nil)
    {
        completion (nil, CosimoMakeError (32, @"Could not find the editor web view."));
        return;
    }

    NSString *script = @"(() => {"
                        "  const inspector = typeof window.__cosimoInspectHostPage === 'function' ? window.__cosimoInspectHostPage() : null;"
                        "  if (inspector) return inspector;"
                        "  const boot = globalThis.__COSIMO_PATCH_BOOT ?? {};"
                        "  const currentURL = window.location.href;"
                        "  const devServerURL = typeof boot.devServerURL === 'string' ? boot.devServerURL : '';"
                        "  const bundlePageURL = typeof boot.bundlePageURL === 'string' ? boot.bundlePageURL : '';"
                        "  const bundleResourceBaseURL = typeof boot.bundleResourceBaseURL === 'string' ? boot.bundleResourceBaseURL : '';"
                        "  const bootSource = devServerURL && currentURL.startsWith(devServerURL) ? 'devServer' : 'bundle';"
                        "  const container = document.getElementById('cmaj-view-container');"
                        "  return {"
                        "    bootSource,"
                        "    currentURL,"
                        "    bundlePageURL,"
                        "    bundleResourceBaseURL,"
                        "    devServerURL,"
                        "    devServerProbe: globalThis.__COSIMO_DEV_SERVER_PROBE ?? null,"
                        "    resourceBaseURL: bootSource === 'devServer' ? devServerURL : bundleResourceBaseURL,"
                        "    documentTitle: document.title,"
                        "    htmlMarker: globalThis.__COSIMO_DEV_HTML_MARKER ?? '',"
                        "    jsMarker: globalThis.__COSIMO_DEV_JS_MARKER ?? '',"
                        "    statusText: '',"
                        "    viewActive: Boolean(container),"
                        "    containerText: container?.innerText ?? ''"
                        "  };"
                        "})()";

    [webView evaluateJavaScript:script completionHandler:^(id _Nullable result, NSError * _Nullable error)
    {
        if (error != nil)
        {
            completion (nil, error);
            return;
        }

        if ([result isKindOfClass:[NSDictionary class]])
        {
            completion ((NSDictionary<NSString *, id> *) result, nil);
            return;
        }

        if (result == nil || [result isKindOfClass:[NSNull class]])
            completion (nil, CosimoMakeError (33, @"The editor did not expose host page inspection yet."));
        else
            completion (@{
                @"resultType": result != nil ? NSStringFromClass ([result class]) : @"nil",
            }, nil);
    }];
}

- (void)reloadEditorHostPageWithCompletion:(CosimoHostResultBlock)completion
{
    if (self.editorController == nil)
    {
        completion (nil, CosimoMakeError (34, @"The editor is not open."));
        return;
    }

    WKWebView *webView = [self findWebViewInView:self.editorController.view];

    if (webView == nil)
    {
        completion (nil, CosimoMakeError (35, @"Could not find the editor web view."));
        return;
    }

    [webView evaluateJavaScript:@"window.location.reload(); true;" completionHandler:^(id _Nullable result, NSError * _Nullable error)
    {
        if (error != nil)
        {
            completion (nil, error);
            return;
        }

        [self collectEditorDOMMetricsAfterDelay:0.35
                              remainingAttempts:12
                                     completion:^(__unused NSDictionary<NSString *,id> * _Nullable ignoredResult, __unused NSError * _Nullable ignoredError)
        {
            [self inspectEditorHostPageWithCompletion:completion];
        }];
    }];
}

- (void)inspectFactoryCatalogWithCompletion:(CosimoHostResultBlock)completion
{
    [self inspectFactoryCatalogAfterDelay:0.0 remainingAttempts:12 completion:completion];
}

- (void)installModulationProfileIndex:(NSUInteger)profileIndex completion:(CosimoHostResultBlock)completion
{
    AUParameter *profile = [self findParameterWithIdentifier:CosimoBenchmarkProfileParameter];
    AUParameter *install = [self findParameterWithIdentifier:CosimoBenchmarkInstallParameter];
    AUParameter *status = [self findParameterWithIdentifier:CosimoBenchmarkInstallStatusParameter];
    AUParameter *generation = [self findParameterWithIdentifier:CosimoBenchmarkInstallGenerationParameter];
    if (profile == nil || install == nil || status == nil || generation == nil || profileIndex >= 7)
    {
        completion (nil, CosimoMakeError (40, @"Benchmark-only cross-process modulation controls are unavailable."));
        return;
    }

    self.benchmarkRuntimeReadyLastSyncRequest = nil;
    [self waitForModulationRuntimeReadyUntil:[NSDate dateWithTimeIntervalSinceNow:90.0]
                                   completion:^(__unused NSDictionary<NSString *,id> * _Nullable readyResult,
                                                NSError * _Nullable readyError)
    {
        if (readyError != nil)
        {
            completion (nil, readyError);
            return;
        }

        const uint64_t baselineGeneration = llround (generation.value * 10000.0f);
        install.value = 0.0f;
        profile.value = (float) profileIndex;
        install.value = 1.0f;
        [self waitForModulationProfileInstallAtIndex:profileIndex
                                  baselineGeneration:baselineGeneration
                                            deadline:[NSDate dateWithTimeIntervalSinceNow:12.0]
                                          completion:completion];
    }];
}

- (void)waitForModulationRuntimeReadyUntil:(NSDate *)deadline
                                 completion:(CosimoHostResultBlock)completion
{
    AUParameter *runtimeReady = [self findParameterWithIdentifier:CosimoBenchmarkRuntimeReadyParameter];
    AUParameter *runtimeReadyRequest = [self findParameterWithIdentifier:CosimoBenchmarkRuntimeReadyRequestParameter];
    if (runtimeReady == nil || runtimeReadyRequest == nil)
    {
        completion (nil, CosimoMakeError (40, @"Benchmark modulation runtime readiness control is unavailable."));
        return;
    }
    if (runtimeReady.value >= 0.5f)
    {
        completion (@{ @"ready": @YES }, nil);
        return;
    }
    if ([deadline timeIntervalSinceNow] <= 0.0)
    {
        completion (nil, CosimoMakeError (42, @"Timed out waiting for the production modulation runtime to become ready."));
        return;
    }

    NSDate *now = [NSDate date];
    if (self.benchmarkRuntimeReadyLastSyncRequest == nil
        || [now timeIntervalSinceDate:self.benchmarkRuntimeReadyLastSyncRequest] >= 1.0)
    {
        self.benchmarkRuntimeReadyLastSyncRequest = now;
        self.benchmarkRuntimeReadyRequestToggle = ! self.benchmarkRuntimeReadyRequestToggle;
        runtimeReadyRequest.value = self.benchmarkRuntimeReadyRequestToggle ? 1.0f : 0.0f;
    }

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.05 * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self waitForModulationRuntimeReadyUntil:deadline completion:completion];
    });
}

- (void)waitForModulationProfileInstallAtIndex:(NSUInteger)profileIndex
                            baselineGeneration:(uint64_t)baselineGeneration
                                      deadline:(NSDate *)deadline
                                    completion:(CosimoHostResultBlock)completion
{
    AUParameter *install = [self findParameterWithIdentifier:CosimoBenchmarkInstallParameter];
    AUParameter *status = [self findParameterWithIdentifier:CosimoBenchmarkInstallStatusParameter];
    AUParameter *generation = [self findParameterWithIdentifier:CosimoBenchmarkInstallGenerationParameter];
    const uint64_t observedGeneration = llround (generation.value * 10000.0f);
    const float observed = status.value;
    if (observedGeneration > baselineGeneration && observed >= 2.5f)
    {
        install.value = 0.0f;
        completion (nil, CosimoMakeError (41, @"The production modulation worker rejected the strict benchmark profile."));
        return;
    }
    if (observedGeneration > baselineGeneration && observed >= 1.5f)
    {
        install.value = 0.0f;
        NSMutableDictionary<NSString *, NSNumber *> *values = [[NSMutableDictionary alloc] init];
        [self readModulationBenchmarkFieldsFromIndex:0
                                        endingBefore:CosimoBenchmarkInstallFieldCount
                                               values:values
                                           completion:^(NSDictionary<NSString *, id> * _Nullable evidence,
                                                        NSError * _Nullable evidenceError)
        {
            if (evidenceError != nil)
            {
                completion (nil, evidenceError);
                return;
            }
            completion (@{
                @"profileIndex": @(profileIndex),
                @"accepted": @YES,
                @"acceptedModulationProgramSerial": @(llround ([evidence[@"acceptedModulationProgramSerial"] doubleValue])),
                @"installedCounts": @{
                    @"voice": @(llround ([evidence[@"installedVoiceRouteCount"] doubleValue])),
                    @"macroVoice": @(llround ([evidence[@"installedMacroVoiceRouteCount"] doubleValue])),
                    @"voiceRack": @(llround ([evidence[@"installedVoiceRackRouteCount"] doubleValue])),
                    @"macroRack": @(llround ([evidence[@"installedMacroRackRouteCount"] doubleValue])),
                },
            }, nil);
        }];
        return;
    }
    if ([deadline timeIntervalSinceNow] <= 0.0)
    {
        install.value = 0.0f;
        AUParameter *profile = [self findParameterWithIdentifier:CosimoBenchmarkProfileParameter];
        completion (nil, CosimoMakeError (42, [NSString stringWithFormat:@"Timed out waiting for the production modulation worker acknowledgement (profile=%.3f, install=%.3f, status=%.3f, generation=%llu, baseline=%llu).",
                                              profile.value,
                                              install.value,
                                              observed,
                                              observedGeneration,
                                              baselineGeneration]));
        return;
    }

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.05 * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self waitForModulationProfileInstallAtIndex:profileIndex
                                  baselineGeneration:baselineGeneration
                                            deadline:deadline
                                          completion:completion];
    });
}

- (void)beginModulationBenchmarkCaptureWithCompletion:(CosimoHostResultBlock)completion
{
    AUParameter *capture = [self findParameterWithIdentifier:CosimoBenchmarkCaptureParameter];
    AUParameter *captureGeneration = [self findParameterWithIdentifier:CosimoBenchmarkCaptureGenerationParameter];
    AUParameter *generation = [self findParameterWithIdentifier:CosimoBenchmarkResultGenerationParameter];
    if (capture == nil || captureGeneration == nil || generation == nil)
    {
        completion (nil, CosimoMakeError (43, @"Benchmark-only cross-process render telemetry is unavailable."));
        return;
    }
    self.benchmarkCaptureBaselineGeneration = llround (generation.value * 10000.0f);
    const uint64_t baselineCaptureGeneration = llround (captureGeneration.value * 10000.0f);
    capture.value = 0.0f;
    capture.value = 1.0f;
    [self waitForModulationBenchmarkCaptureStartedUntil:[NSDate dateWithTimeIntervalSinceNow:2.0]
                              baselineCaptureGeneration:baselineCaptureGeneration
                                              completion:completion];
}

- (void)waitForModulationBenchmarkCaptureStartedUntil:(NSDate *)deadline
                             baselineCaptureGeneration:(uint64_t)baselineCaptureGeneration
                                            completion:(CosimoHostResultBlock)completion
{
    AUParameter *generation = [self findParameterWithIdentifier:CosimoBenchmarkCaptureGenerationParameter];
    const uint64_t observedGeneration = llround (generation.value * 10000.0f);
    if (observedGeneration > baselineCaptureGeneration)
    {
        completion (@{ @"started": @YES }, nil);
        return;
    }
    if ([deadline timeIntervalSinceNow] <= 0.0)
    {
        completion (nil, CosimoMakeError (46, [NSString stringWithFormat:@"Timed out starting cross-process render telemetry (generation=%llu, baseline=%llu).",
                                              observedGeneration,
                                              baselineCaptureGeneration]));
        return;
    }
    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.1 * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self waitForModulationBenchmarkCaptureStartedUntil:deadline
                                  baselineCaptureGeneration:baselineCaptureGeneration
                                                  completion:completion];
    });
}

- (void)finishModulationBenchmarkCaptureWithCompletion:(CosimoHostResultBlock)completion
{
    AUParameter *capture = [self findParameterWithIdentifier:CosimoBenchmarkCaptureParameter];
    if (capture == nil)
    {
        completion (nil, CosimoMakeError (44, @"Benchmark-only cross-process render telemetry is unavailable."));
        return;
    }
    capture.value = 0.0f;
    capture.value = 2.0f;
    [self readCompletedModulationBenchmarkAfterAttempts:40 completion:completion];
}

- (void)readCompletedModulationBenchmarkAfterAttempts:(NSInteger)remainingAttempts
                                           completion:(CosimoHostResultBlock)completion
{
    AUParameter *generation = [self findParameterWithIdentifier:CosimoBenchmarkResultGenerationParameter];
    const uint64_t observedGeneration = llround (generation.value * 10000.0f);
    if (observedGeneration <= self.benchmarkCaptureBaselineGeneration && remainingAttempts > 0)
    {
        dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.05 * NSEC_PER_SEC)),
                        dispatch_get_main_queue(), ^
        {
            [self readCompletedModulationBenchmarkAfterAttempts:remainingAttempts - 1 completion:completion];
        });
        return;
    }
    if (observedGeneration <= self.benchmarkCaptureBaselineGeneration)
    {
        AUParameter *captureGeneration = [self findParameterWithIdentifier:CosimoBenchmarkCaptureGenerationParameter];
        AUParameter *captureStopGeneration = [self findParameterWithIdentifier:CosimoBenchmarkCaptureStopGenerationParameter];
        const uint64_t observedCaptureGeneration = llround (captureGeneration.value * 10000.0f);
        const uint64_t observedCaptureStopGeneration = llround (captureStopGeneration.value * 10000.0f);
        completion (nil, CosimoMakeError (47, [NSString stringWithFormat:@"Timed out reading completed cross-process render telemetry (generation=%llu, baseline=%llu, captureGeneration=%llu, captureStopGeneration=%llu).",
                                              observedGeneration,
                                              self.benchmarkCaptureBaselineGeneration,
                                              observedCaptureGeneration,
                                              observedCaptureStopGeneration]));
        return;
    }

    NSMutableDictionary<NSString *, NSNumber *> *values = [[NSMutableDictionary alloc] init];
    [self readModulationBenchmarkFieldsFromIndex:CosimoBenchmarkRenderFieldStart
                                    endingBefore:CosimoBenchmarkResultFieldIdentifiers().count
                                           values:values
                                       completion:^(NSDictionary<NSString *, id> * _Nullable fields,
                                                    NSError * _Nullable fieldsError)
    {
        if (fieldsError != nil)
        {
            completion (nil, fieldsError);
            return;
        }

        const uint64_t blockCount = llround ([fields[@"renderBlockCount"] doubleValue]);
        const uint32_t voiceMask = (uint32_t) llround ([fields[@"voiceMask"] doubleValue]);
        NSMutableArray<NSNumber *> *voiceIndexes = [[NSMutableArray alloc] init];
        for (NSUInteger voiceIndex = 0; voiceIndex < CosimoBenchmarkVoiceCount; ++voiceIndex)
            if ((voiceMask & (1u << voiceIndex)) != 0)
                [voiceIndexes addObject:@(voiceIndex)];

        completion (@{
            @"renderMetrics": @{
                @"renderBlockCount": @(blockCount),
                @"capturedRenderSampleCount": @(llround ([fields[@"capturedRenderSampleCount"] doubleValue])),
                @"dspSampleRate": fields[@"dspSampleRate"],
                @"audioFrames": @(llround ([fields[@"audioFrames"] doubleValue])),
                @"minimumFrames": @(llround ([fields[@"minimumFrames"] doubleValue])),
                @"maximumFrames": @(llround ([fields[@"maximumFrames"] doubleValue])),
                @"renderLoadPercent": fields[@"renderLoadPercent"],
                @"p99RenderLoadPercent": fields[@"p99RenderLoadPercent"],
                @"p999RenderLoadPercent": fields[@"p999RenderLoadPercent"],
                @"maximumRenderLoadPercent": fields[@"maximumRenderLoadPercent"],
                @"deadlineMissCount": @(llround ([fields[@"deadlineMissCount"] doubleValue])),
            },
            @"uniqueVoiceIndexes": voiceIndexes,
            @"uniqueVoiceCount": @(voiceIndexes.count),
            @"rackEnableMask": @(llround ([fields[@"rackEnableMask"] doubleValue])),
        }, nil);
    }];
}

- (void)readModulationBenchmarkFieldsFromIndex:(NSUInteger)fieldIndex
                                  endingBefore:(NSUInteger)endIndex
                                         values:(NSMutableDictionary<NSString *, NSNumber *> *)values
                                     completion:(CosimoHostResultBlock)completion
{
    NSArray<NSString *> *identifiers = CosimoBenchmarkResultFieldIdentifiers();

    if (fieldIndex >= endIndex)
    {
        completion ([values copy], nil);
        return;
    }
    if (endIndex > identifiers.count)
    {
        completion (nil, CosimoMakeError (45, @"Benchmark result field range is invalid."));
        return;
    }

    AUParameter *request = [self findParameterWithIdentifier:CosimoBenchmarkResultFieldRequestParameter];
    AUParameter *response = [self findParameterWithIdentifier:CosimoBenchmarkResultFieldResponseParameter];
    if (request == nil || response == nil)
    {
        completion (nil, CosimoMakeError (45, @"Benchmark result request/response parameters are unavailable."));
        return;
    }

    request.value = (float) (fieldIndex + 1);
    [self waitForModulationBenchmarkFieldAtIndex:fieldIndex
                                     endingBefore:endIndex
                                           values:values
                                remainingAttempts:40
                                       completion:completion];
}

- (void)waitForModulationBenchmarkFieldAtIndex:(NSUInteger)fieldIndex
                                   endingBefore:(NSUInteger)endIndex
                                         values:(NSMutableDictionary<NSString *, NSNumber *> *)values
                              remainingAttempts:(NSInteger)remainingAttempts
                                     completion:(CosimoHostResultBlock)completion
{
    NSArray<NSString *> *identifiers = CosimoBenchmarkResultFieldIdentifiers();
    NSArray<NSNumber *> *scales = CosimoBenchmarkResultFieldScales();

    AUParameter *response = [self findParameterWithIdentifier:CosimoBenchmarkResultFieldResponseParameter];
    const double encoded = response.value * (double) identifiers.count;
    const double minimum = (double) fieldIndex + 0.24;
    const double maximum = (double) fieldIndex + 0.76;
    if (encoded >= minimum && encoded <= maximum)
    {
        const double normalized = std::clamp ((encoded - (double) fieldIndex - 0.25) / 0.5, 0.0, 1.0);
        values[identifiers[fieldIndex]] = @(normalized * scales[fieldIndex].doubleValue);
        [self readModulationBenchmarkFieldsFromIndex:fieldIndex + 1
                                        endingBefore:endIndex
                                               values:values
                                           completion:completion];
        return;
    }

    if (remainingAttempts <= 0)
    {
        completion (nil, CosimoMakeError (48, [NSString stringWithFormat:@"Timed out reading modulation benchmark result field %lu (response=%.6f).",
                                              (unsigned long) fieldIndex,
                                              response.value]));
        return;
    }

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.05 * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self waitForModulationBenchmarkFieldAtIndex:fieldIndex
                                         endingBefore:endIndex
                                               values:values
                                    remainingAttempts:remainingAttempts - 1
                                           completion:completion];
    });
}

- (void)coolForModulationMeasurementWithCompletion:(CosimoHostResultBlock)completion
{
    if (self.engine.isRunning)
        [self.engine pause];

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW,
                                   (int64_t) (CosimoThermalCooldownMinimumSeconds * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self waitForSafeThermalStateUntil:[NSDate dateWithTimeIntervalSinceNow:CosimoThermalCooldownTimeoutSeconds]
                                completion:completion];
    });
}

- (void)waitForSafeThermalStateUntil:(NSDate *)deadline
                           completion:(CosimoHostResultBlock)completion
{
    const auto thermalState = NSProcessInfo.processInfo.thermalState;
    if (thermalState == NSProcessInfoThermalStateNominal
        || thermalState == NSProcessInfoThermalStateFair)
    {
        if (self.engine.isRunning)
        {
            completion (@{ @"thermalState": CosimoThermalStateName (thermalState) }, nil);
            return;
        }

        NSError *startError = nil;
        if (! [self.engine startAndReturnError:&startError])
        {
            completion (nil, startError ?: CosimoMakeError (53, @"Could not restart audio after thermal cooldown."));
            return;
        }

        dispatch_after (dispatch_time (DISPATCH_TIME_NOW,
                                       (int64_t) (CosimoThermalRestartSettleSeconds * NSEC_PER_SEC)),
                        dispatch_get_main_queue(), ^
        {
            completion (@{ @"thermalState": CosimoThermalStateName (thermalState) }, nil);
        });
        return;
    }

    if ([deadline timeIntervalSinceNow] <= 0.0)
    {
        completion (nil, CosimoMakeError (52, @"Timed out cooling the iPhone to a safe state before measurement."));
        return;
    }

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW,
                                   (int64_t) (CosimoThermalCooldownPollSeconds * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self waitForSafeThermalStateUntil:deadline completion:completion];
    });
}

- (void)measureModulationPhaseNamed:(NSString *)phaseName
                    durationSeconds:(NSTimeInterval)durationSeconds
                         completion:(CosimoHostResultBlock)completion
{
    if (self.instrumentUnit == nil || self.engine == nil)
    {
        completion (nil, CosimoMakeError (46, @"Instantiate the AUv3 before measuring modulation."));
        return;
    }
    if (!(durationSeconds > 0.0))
    {
        completion (nil, CosimoMakeError (47, @"Benchmark phase duration must be positive."));
        return;
    }

    [self coolForModulationMeasurementWithCompletion:^(__unused NSDictionary<NSString *,id> * _Nullable thermalResult,
                                                        NSError * _Nullable thermalError)
    {
        if (thermalError != nil)
        {
            completion (nil, thermalError);
            return;
        }
        [self prepareNeutralModulationBenchmarkSourcesWithCompletion:^(__unused NSDictionary<NSString *,id> * _Nullable prepareResult,
                                                                       NSError * _Nullable prepareError)
        {
            if (prepareError != nil)
            {
                completion (nil, prepareError);
                return;
            }
            [self beginModulationBenchmarkCaptureWithCompletion:^(__unused NSDictionary<NSString *,id> * _Nullable beginResult,
                                                                  NSError * _Nullable beginError)
            {
                if (beginError != nil)
                {
                    completion (nil, beginError);
                    return;
                }
                [self measureStartedModulationPhaseNamed:phaseName
                                         durationSeconds:durationSeconds
                                              completion:completion];
            }];
        }];
    }];
}

- (void)prepareNeutralModulationBenchmarkSourcesWithCompletion:(CosimoHostResultBlock)completion
{
    AUScheduleMIDIEventBlock midiBlock = self.instrumentUnit.AUAudioUnit.scheduleMIDIEventBlock;
    if (midiBlock == nil)
    {
        completion (nil, CosimoMakeError (48, @"The AUv3 did not provide a MIDI schedule block."));
        return;
    }

    for (NSUInteger macroIndex = 1; macroIndex <= 4; ++macroIndex)
    {
        AUParameter *parameter = [self findParameterWithIdentifier:[NSString stringWithFormat:@"macro%lu", (unsigned long) macroIndex]];
        if (parameter != nil)
            parameter.value = 0.75f;
    }

    for (NSUInteger voiceIndex = 0; voiceIndex < CosimoBenchmarkVoiceCount; ++voiceIndex)
    {
        const uint8_t noteOn[] = { 0x90, (uint8_t) (48 + voiceIndex), 100 };
        midiBlock (AUEventSampleTimeImmediate, 0, 3, noteOn);
    }
    const uint8_t pressure[] = { 0xd0, 100 };
    const uint8_t slide[] = { 0xb0, 74, 100 };
    midiBlock (AUEventSampleTimeImmediate, 0, 2, pressure);
    midiBlock (AUEventSampleTimeImmediate, 0, 3, slide);

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW,
                                   (int64_t) (CosimoNeutralSourceSettleSeconds * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        completion (@{ @"settled": @YES }, nil);
    });
}

- (void)measureStartedModulationPhaseNamed:(NSString *)phaseName
                            durationSeconds:(NSTimeInterval)durationSeconds
                                 completion:(CosimoHostResultBlock)completion
{

    AUScheduleMIDIEventBlock midiBlock = self.instrumentUnit.AUAudioUnit.scheduleMIDIEventBlock;
    if (midiBlock == nil)
    {
        completion (nil, CosimoMakeError (48, @"The AUv3 did not provide a MIDI schedule block."));
        return;
    }

    AVAudioMixerNode *mixer = self.engine.mainMixerNode;
    AVAudioFormat *format = [mixer outputFormatForBus:0];
    auto capture = std::make_shared<CosimoModulationPhaseCapture>();
    const auto thermalBefore = NSProcessInfo.processInfo.thermalState;
    const uint64_t wallStart = mach_absolute_time();

    [mixer removeTapOnBus:0];
    [mixer installTapOnBus:0
                bufferSize:CosimoBenchmarkBufferFrames
                    format:format
                     block:^ (AVAudioPCMBuffer *buffer, AVAudioTime *when)
    {
        const AVAudioFrameCount frameCount = buffer.frameLength;
        if (frameCount == 0 || buffer.floatChannelData == nullptr)
            return;

        const uint64_t tapArrivalTime = mach_absolute_time();
        if (capture->previousTapArrivalTime != 0 && tapArrivalTime > capture->previousTapArrivalTime)
        {
            const double expectedSeconds = (double) capture->previousFrameCount / format.sampleRate;
            const double gapRatio = expectedSeconds > 0.0
                ? CosimoTimeIntervalSeconds (capture->previousTapArrivalTime, tapArrivalTime) / expectedSeconds
                : 0.0;
            capture->maximumTapArrivalGapRatio = std::max (capture->maximumTapArrivalGapRatio, gapRatio);
            if (gapRatio > 1.25) ++capture->tapArrivalGapOver125PercentCount;
            if (capture->recordedGapCount < capture->gapRatios.size())
                capture->gapRatios[capture->recordedGapCount++] = gapRatio;
        }

        if (when.isSampleTimeValid && capture->previousSampleTime >= 0)
        {
            const AVAudioFramePosition expectedSampleTime = capture->previousSampleTime + capture->previousFrameCount;
            if (when.sampleTime != expectedSampleTime)
                ++capture->sampleTimeDiscontinuityCount;
        }
        if (when.isSampleTimeValid)
            capture->previousSampleTime = when.sampleTime;

        capture->previousTapArrivalTime = tapArrivalTime;
        capture->previousFrameCount = frameCount;
        capture->callbackCount += 1;
        capture->audioFrames += frameCount;
        capture->minimumBufferFrames = std::min (capture->minimumBufferFrames, frameCount);
        capture->maximumBufferFrames = std::max (capture->maximumBufferFrames, frameCount);

        for (UInt32 channel = 0; channel < buffer.format.channelCount; ++channel)
        {
            const float *samples = buffer.floatChannelData[channel];
            for (AVAudioFrameCount frame = 0; frame < frameCount; ++frame)
            {
                const double sample = samples[frame];
                capture->sampleCount += 1;
                if (!std::isfinite (sample))
                {
                    capture->nonFiniteSampleCount += 1;
                    continue;
                }
                capture->energy += sample * sample;
                capture->peak = std::max (capture->peak, std::abs (sample));
                if (std::abs (sample) > 1.0) ++capture->clippedSampleCount;
            }
        }
    }];

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (durationSeconds * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        for (NSUInteger voiceIndex = 0; voiceIndex < CosimoBenchmarkVoiceCount; ++voiceIndex)
        {
            const uint8_t noteOff[] = { 0x80, (uint8_t) (48 + voiceIndex), 0 };
            midiBlock (AUEventSampleTimeImmediate, 0, 3, noteOff);
        }
        [mixer removeTapOnBus:0];

        const uint64_t wallEnd = mach_absolute_time();
        const auto thermalAfter = NSProcessInfo.processInfo.thermalState;
        const double wallSeconds = CosimoTimeIntervalSeconds (wallStart, wallEnd);
        const double audioSeconds = format.sampleRate > 0.0
            ? (double) capture->audioFrames / format.sampleRate
            : 0.0;
        const double rms = capture->sampleCount > capture->nonFiniteSampleCount
            ? std::sqrt (capture->energy / (double) (capture->sampleCount - capture->nonFiniteSampleCount))
            : 0.0;

        std::vector<double> sortedGaps (capture->gapRatios.begin(),
                                        capture->gapRatios.begin() + capture->recordedGapCount);
        std::sort (sortedGaps.begin(), sortedGaps.end());
        const NSUInteger p99Index = sortedGaps.empty()
            ? 0
            : std::min (sortedGaps.size() - 1,
                        (NSUInteger) std::floor ((double) sortedGaps.size() * 0.99));
        const double p99GapRatio = sortedGaps.empty() ? 0.0 : sortedGaps[p99Index];
        const uint64_t measuredGapCount = capture->callbackCount > 0 ? capture->callbackCount - 1 : 0;

        NSMutableDictionary<NSString *, id> *hostMetrics = [@{
            @"phase": phaseName,
            @"durationSeconds": @(durationSeconds),
            @"wallSeconds": @(wallSeconds),
            @"audioSeconds": @(audioSeconds),
            @"wallToAudioRatio": @(audioSeconds > 0.0 ? wallSeconds / audioSeconds : 0.0),
            @"sampleRate": @(format.sampleRate),
            @"callbackCount": @(capture->callbackCount),
            @"measuredGapCount": @(measuredGapCount),
            @"minimumBufferFrames": @(capture->minimumBufferFrames == UINT32_MAX ? 0 : capture->minimumBufferFrames),
            @"maximumBufferFrames": @(capture->maximumBufferFrames),
            @"p99TapArrivalGapRatio": @(p99GapRatio),
            @"maximumTapArrivalGapRatio": @(capture->maximumTapArrivalGapRatio),
            @"tapArrivalGapOver125PercentCount": @(capture->tapArrivalGapOver125PercentCount),
            @"tapArrivalGapOver125PercentRate": @(measuredGapCount > 0 ? (double) capture->tapArrivalGapOver125PercentCount / measuredGapCount : 0.0),
            @"sampleTimeDiscontinuityCount": @(capture->sampleTimeDiscontinuityCount),
            @"rms": @(rms),
            @"peak": @(capture->peak),
            @"nonFiniteSampleCount": @(capture->nonFiniteSampleCount),
            @"clippedSampleCount": @(capture->clippedSampleCount),
            @"thermalStateBefore": CosimoThermalStateName (thermalBefore),
            @"thermalStateAfter": CosimoThermalStateName (thermalAfter),
            @"requestedVoiceCount": @(CosimoBenchmarkVoiceCount),
        } mutableCopy];

        [self finishModulationBenchmarkCaptureWithCompletion:^(NSDictionary<NSString *,id> * _Nullable renderResult,
                                                               NSError * _Nullable renderError)
        {
            if (renderError != nil)
            {
                completion (nil, renderError);
                return;
            }
            hostMetrics[@"renderMetrics"] = renderResult[@"renderMetrics"] ?: @{};
            hostMetrics[@"uniqueVoiceIndexes"] = renderResult[@"uniqueVoiceIndexes"] ?: @[];
            hostMetrics[@"uniqueVoiceCount"] = renderResult[@"uniqueVoiceCount"] ?: @0;
            hostMetrics[@"rackEnableMask"] = renderResult[@"rackEnableMask"] ?: @(-1);
            completion (hostMetrics, nil);
        }];
    });
}

- (void)inspectFactoryCatalogAfterDelay:(NSTimeInterval)delay
                      remainingAttempts:(NSInteger)remainingAttempts
                             completion:(CosimoHostResultBlock)completion
{
    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (delay * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self inspectFactoryCatalogNowWithCompletion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
        {
            if (result != nil || remainingAttempts <= 0)
            {
                completion (result, error);
                return;
            }

            [self inspectFactoryCatalogAfterDelay:0.25
                                remainingAttempts:remainingAttempts - 1
                                       completion:completion];
        }];
    });
}

- (void)inspectFactoryCatalogNowWithCompletion:(CosimoHostResultBlock)completion
{
    if (self.editorController == nil)
    {
        completion (nil, CosimoMakeError (36, @"The editor is not open."));
        return;
    }

    WKWebView *webView = [self findWebViewInView:self.editorController.view];

    if (webView == nil)
    {
        completion (nil, CosimoMakeError (37, @"Could not find the editor web view."));
        return;
    }

    NSString *script = @"const patchConnection = globalThis.__cosimoPatchConnection;"
                        "if (! patchConnection) throw new Error('The patch connection is not ready yet.');"
                        "const response = await fetch(patchConnection.getResourceAddress('assets/factory-bank-catalog.json'));"
                        "if (! response.ok) throw new Error(`Could not load the runtime catalog: ${response.status}`);"
                        "const catalog = await response.json();"
                        "const tables = Array.isArray(catalog.tables) ? catalog.tables : [];"
                        "const firstTable = tables[0] ?? {};"
                        "let firstTableAudioSampleRate = null;"
                        "let firstTableAudioFrameCount = null;"
                        "let firstTableAudioError = '';"
                        "if (typeof patchConnection.readResourceAsAudioData === 'function' && typeof firstTable.sourceWav === 'string' && firstTable.sourceWav.length > 0) {"
                        "  try {"
                        "    const audioFile = await patchConnection.readResourceAsAudioData(firstTable.sourceWav);"
                        "    const frames = Array.isArray(audioFile?.frames) || ArrayBuffer.isView(audioFile?.frames) ? Array.from(audioFile.frames) : [];"
                        "    firstTableAudioSampleRate = Number(audioFile?.sampleRate) || 0;"
                        "    firstTableAudioFrameCount = frames.length;"
                        "  } catch (error) {"
                        "    firstTableAudioError = error?.stack || error?.message || String(error);"
                        "  }"
                        "}"
                        "return {"
                        "  tableCount: tables.length,"
                        "  firstTableName: typeof firstTable.name === 'string' ? firstTable.name : '',"
                        "  firstTableSourceWav: typeof firstTable.sourceWav === 'string' ? firstTable.sourceWav : '',"
                        "  firstTableAudioSampleRate,"
                        "  firstTableAudioFrameCount,"
                        "  firstTableAudioError"
                        "};";

    [webView callAsyncJavaScript:script
                       arguments:@{}
                         inFrame:nil
                  inContentWorld:WKContentWorld.pageWorld
               completionHandler:^(id _Nullable result, NSError * _Nullable error)
    {
        if (error != nil)
        {
            NSString *description = error.localizedDescription ?: @"Unknown runtime catalog error";

            if ([description containsString:@"patch connection is not ready yet"])
            {
                completion (nil, nil);
                return;
            }

            completion (nil, error);
            return;
        }

        if ([result isKindOfClass:[NSDictionary class]])
        {
            completion ((NSDictionary<NSString *, id> *) result, nil);
            return;
        }

        completion (@{
            @"resultType": result != nil ? NSStringFromClass ([result class]) : @"nil",
        }, nil);
    }];
}

- (void)closeEditorWithCompletion:(CosimoHostResultBlock)completion
{
    if (self.editorController == nil)
    {
        if (completion != nil)
            completion (@{ @"closed": @YES }, nil);

        return;
    }

    [self.editorController willMoveToParentViewController:nil];
    [self.editorController.view removeFromSuperview];
    [self.editorController removeFromParentViewController];
    self.editorController = nil;

    if (completion != nil)
        completion (@{ @"closed": @YES }, nil);
}

- (void)saveStateNamed:(NSString *)stateName completion:(CosimoHostResultBlock)completion
{
    NSString *stateSource = nil;
    NSDictionary<NSString *, id> *fullState = [self currentPersistedStateWithSource:&stateSource];
    NSDictionary<NSString *, NSNumber *> *verificationParameters = [self currentVerificationParameters];

    if (fullState == nil)
    {
        completion (nil, CosimoMakeError (18, [NSString stringWithFormat:@"The AUv3 did not provide a persistable state dictionary. %@", [self describePersistableStateAvailability]]));
        return;
    }

    NSDictionary<NSString *, id> *stateEnvelope = @{
        @"stateSource": stateSource ?: @"fullState",
        @"statePayload": fullState,
        @"verificationParameters": verificationParameters ?: @{},
    };

    NSError *serialiseError = nil;
    NSData *plist = [NSPropertyListSerialization dataWithPropertyList:stateEnvelope
                                                               format:NSPropertyListBinaryFormat_v1_0
                                                              options:0
                                                                error:&serialiseError];

    if (plist == nil)
    {
        completion (nil, serialiseError ?: CosimoMakeError (19, @"Could not serialise the AUv3 state dictionary."));
        return;
    }

    NSURL *url = [self stateFileURLForName:stateName];
    NSError *writeError = nil;

    if (! [plist writeToURL:url options:NSDataWritingAtomic error:&writeError])
    {
        completion (nil, writeError ?: CosimoMakeError (20, @"Could not write the AUv3 saved state to disk."));
        return;
    }

    NSArray<NSString *> *keys = [[fullState allKeys] sortedArrayUsingSelector:@selector(compare:)];

    completion (@{
        @"savedStateKeys": keys,
        @"stateSource": stateSource ?: @"fullState",
    }, nil);
}

- (void)reloadStateNamed:(NSString *)stateName completion:(CosimoHostResultBlock)completion
{
    NSString *stateSource = nil;
    NSDictionary<NSString *, NSNumber *> *verificationParameters = nil;
    NSDictionary<NSString *, id> *savedState = [self readStateNamed:stateName
                                                             source:&stateSource
                                             verificationParameters:&verificationParameters
                                                              error:nil];

    if (savedState == nil)
    {
        completion (nil, CosimoMakeError (21, @"Could not read the saved AUv3 state from disk."));
        return;
    }

    [self closeEditorWithCompletion:nil];
    [self teardownAudioOnly];

    [self instantiateExtensionWithCompletion:^ (NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        if (error != nil)
        {
            completion (nil, error);
            return;
        }

        [self applySavedState:savedState
                       source:stateSource
          verificationParameters:verificationParameters
                   completion:completion];
    }];
}

- (void)loadSavedStateNamed:(NSString *)stateName completion:(CosimoHostResultBlock)completion
{
    NSString *stateSource = nil;
    NSDictionary<NSString *, NSNumber *> *verificationParameters = nil;
    NSDictionary<NSString *, id> *savedState = [self readStateNamed:stateName
                                                             source:&stateSource
                                             verificationParameters:&verificationParameters
                                                              error:nil];

    if (savedState == nil)
    {
        completion (nil, CosimoMakeError (22, @"Could not read the saved AUv3 state from disk."));
        return;
    }

    if (self.instrumentUnit == nil)
    {
        [self instantiateExtensionWithCompletion:^ (NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
        {
            if (error != nil)
            {
                completion (nil, error);
                return;
            }

            [self applySavedState:savedState
                           source:stateSource
              verificationParameters:verificationParameters
                       completion:completion];
        }];

        return;
    }

    [self applySavedState:savedState
                   source:stateSource
      verificationParameters:verificationParameters
               completion:completion];
}

- (void)teardown
{
    [self closeEditorWithCompletion:nil];
    [self teardownAudioOnly];
}

#pragma mark - Internals

- (void)applySavedState:(NSDictionary<NSString *, id> *)savedState
                 source:(NSString *)stateSource
   verificationParameters:(NSDictionary<NSString *, NSNumber *> *)verificationParameters
             completion:(CosimoHostResultBlock)completion
{
    if ([stateSource isEqualToString:@"fullStateForDocument"])
        self.instrumentUnit.AUAudioUnit.fullStateForDocument = savedState;
    else if (stateSource == nil || [stateSource isEqualToString:@"fullState"])
        self.instrumentUnit.AUAudioUnit.fullState = savedState;
    else
    {
        completion (nil, CosimoMakeError (23,
                                          [NSString stringWithFormat:@"Unsupported saved-state source '%@'. The smoke harness now requires a real AU state dictionary.", stateSource]));
        return;
    }

    [self pollForRestoredVerificationParameters:verificationParameters
                                     stateSource:stateSource
                                        deadline:(CFAbsoluteTimeGetCurrent() + CosimoStateVerificationTimeoutSeconds)
                                      completion:completion];
}

- (void)teardownAudioOnly
{
    if (self.engine != nil)
    {
        [self.engine.mainMixerNode removeTapOnBus:0];
        [self.engine stop];

        if (self.instrumentUnit != nil && [self.engine.attachedNodes containsObject:self.instrumentUnit])
            [self.engine detachNode:self.instrumentUnit];
    }

    self.instrumentUnit = nil;
    self.engine = nil;
    self.parameterSnapshot = nil;
}

- (NSDictionary<NSString *, id> *)currentPersistedStateWithSource:(NSString * __autoreleasing _Nullable *)stateSource
{
    NSDictionary<NSString *, id> *presetState = self.instrumentUnit.AUAudioUnit.fullState;

    if (presetState != nil)
    {
        if (stateSource != nil)
            *stateSource = @"fullState";

        return presetState;
    }

    NSDictionary<NSString *, id> *documentState = self.instrumentUnit.AUAudioUnit.fullStateForDocument;

    if (documentState != nil)
    {
        if (stateSource != nil)
            *stateSource = @"fullStateForDocument";

        return documentState;
    }

    if (stateSource != nil)
        *stateSource = nil;

    return nil;
}

- (NSString *)describePersistableStateAvailability
{
    AUAudioUnit *audioUnit = self.instrumentUnit.AUAudioUnit;
    NSDictionary<NSString *, id> *fullState = audioUnit.fullState;
    NSDictionary<NSString *, id> *documentState = audioUnit.fullStateForDocument;
    NSArray<AUParameter *> *parameters = audioUnit.parameterTree.allParameters ?: @[];
    AUAudioUnitPreset *currentPreset = audioUnit.currentPreset;

    return [NSString stringWithFormat:@"fullState=%@ fullStateForDocument=%@ parameterCount=%lu supportsUserPresets=%@ currentPreset=%@",
            fullState != nil ? @"yes" : @"no",
            documentState != nil ? @"yes" : @"no",
            (unsigned long) parameters.count,
            audioUnit.supportsUserPresets ? @"yes" : @"no",
            currentPreset.name ?: @"<none>"];
}

- (NSArray<AVAudioUnitComponent *> *)matchingCosimoComponents
{
    AudioComponentDescription description = CosimoComponentDescription();
    AVAudioUnitComponentManager *manager = [AVAudioUnitComponentManager sharedAudioUnitComponentManager];
    return [manager componentsMatchingDescription:description];
}

- (NSString *)unavailableComponentMessage
{
    NSArray<NSDictionary<NSString *, id> *> *availableComponents = [self availableMusicDeviceSummaries];

    if (availableComponents.count == 0)
        return @"Could not discover the Cosimo Synth AUv3 extension. The phone returned no music-device audio units.";

    NSError *error = nil;
    NSData *json = [NSJSONSerialization dataWithJSONObject:availableComponents options:0 error:&error];
    NSString *summary = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];

    if (summary.length == 0)
        summary = error.localizedDescription ?: @"Could not encode the available music-device list.";

    return [NSString stringWithFormat:@"Could not discover the Cosimo Synth AUv3 extension. Available music devices: %@", summary];
}

- (NSArray<NSDictionary<NSString *, id> *> *)availableMusicDeviceSummaries
{
    AVAudioUnitComponentManager *manager = [AVAudioUnitComponentManager sharedAudioUnitComponentManager];
    NSArray<AVAudioUnitComponent *> *components = [manager componentsPassingTest:^ BOOL (AVAudioUnitComponent *component, BOOL *stop)
    {
        return component.audioComponentDescription.componentType == kAudioUnitType_MusicDevice;
    }];

    NSMutableArray<NSDictionary<NSString *, id> *> *summaries = [[NSMutableArray alloc] initWithCapacity:components.count];

    for (AVAudioUnitComponent *component in components)
    {
        AudioComponentDescription description = component.audioComponentDescription;
        [summaries addObject:@{
            @"name": component.name ?: @"",
            @"manufacturerName": component.manufacturerName ?: @"",
            @"type": CosimoStringFromFourCC (description.componentType),
            @"subType": CosimoStringFromFourCC (description.componentSubType),
            @"manufacturer": CosimoStringFromFourCC (description.componentManufacturer),
            @"version": component.versionString ?: @"",
        }];
    }

    return summaries;
}

- (void)instantiateAudioUnitWithDescription:(AudioComponentDescription)description
                                 completion:(void (^ _Nonnull)(AVAudioUnit * _Nullable audioUnit, NSError * _Nullable error))completion
{
    AVAudioSession *session = [AVAudioSession sharedInstance];
    [session setCategory:AVAudioSessionCategoryPlayback error:nil];
    [session setPreferredSampleRate:CosimoBenchmarkSampleRate error:nil];
    [session setPreferredIOBufferDuration:(CosimoBenchmarkBufferFrames / CosimoBenchmarkSampleRate) error:nil];
    [session setActive:YES error:nil];

    [AVAudioUnit instantiateWithComponentDescription:description
                                             options:kAudioComponentInstantiation_LoadOutOfProcess
                                   completionHandler:^ (AVAudioUnit * _Nullable audioUnit, NSError * _Nullable error)
    {
        dispatch_async (dispatch_get_main_queue(), ^
        {
            completion (audioUnit, error);
        });
    }];
}

- (void)finishInstantiatingAudioUnit:(AVAudioUnit *)audioUnit
                          completion:(CosimoHostResultBlock)completion
{
    NSArray<AVAudioUnitComponent *> *components = [self matchingCosimoComponents];

    if (components.count > 0)
        self.component = components.firstObject;

    self.engine = [[AVAudioEngine alloc] init];
    self.instrumentUnit = audioUnit;
    // Request the smallest practical outer AUv3 callback before AVAudioEngine allocates
    // render resources. iOS sample-rate conversion may still aggregate a larger outer
    // processBlock; the generated Cmajor performer independently hard-limits its inner
    // render slices to 128 frames.
    audioUnit.AUAudioUnit.maximumFramesToRender = CosimoBenchmarkBufferFrames;
    [self.engine attachNode:audioUnit];
    AVAudioFormat *benchmarkFormat = [[AVAudioFormat alloc] initStandardFormatWithSampleRate:CosimoBenchmarkSampleRate
                                                                                   channels:2];
    [self.engine connect:audioUnit to:self.engine.mainMixerNode format:benchmarkFormat];

    NSError *startError = nil;

    if (! [self.engine startAndReturnError:&startError])
    {
        completion (nil, startError ?: CosimoMakeError (12, @"Could not start the host audio engine."));
        return;
    }

    self.parameterSnapshot = [self serialiseParameters];

    completion (@{
        @"componentName": self.component.name ?: audioUnit.name ?: @"Cosimo Synth",
        @"audioUnitName": audioUnit.name ?: self.component.name ?: @"Cosimo Synth",
    }, nil);
}

- (NSArray<NSDictionary<NSString *, id> *> *)serialiseParameters
{
    NSMutableArray<NSDictionary<NSString *, id> *> *parameters = [[NSMutableArray alloc] init];

    for (AUParameter *parameter in self.instrumentUnit.AUAudioUnit.parameterTree.allParameters)
    {
        [parameters addObject:@{
            @"address": @(parameter.address),
            @"identifier": parameter.identifier ?: @"",
            @"displayName": parameter.displayName ?: parameter.identifier ?: @"",
        }];
    }

    return parameters;
}

- (AUParameter *)findParameterWithIdentifier:(NSString *)identifier
{
    for (AUParameter *parameter in self.instrumentUnit.AUAudioUnit.parameterTree.allParameters)
    {
        if ([parameter.identifier isEqualToString:identifier] || [parameter.displayName isEqualToString:identifier])
            return parameter;
    }

    return nil;
}

- (NSDictionary<NSString *, id> *)currentEditorMetrics:(BOOL)opened
{
    CGSize preferredSize = self.editorController.preferredContentSize;
    CGSize containerSize = self.editorContainerView.bounds.size;
    CGSize viewSize = self.editorController.view.bounds.size;
    WKWebView *webView = self.editorController != nil ? [self findWebViewInView:self.editorController.view] : nil;

    return @{
        @"opened": @(opened),
        @"preferredWidth": @(preferredSize.width),
        @"preferredHeight": @(preferredSize.height),
        @"containerWidth": @(containerSize.width),
        @"containerHeight": @(containerSize.height),
        @"viewWidth": @(viewSize.width),
        @"viewHeight": @(viewSize.height),
        @"hasWebView": @(webView != nil),
        @"editorTitle": self.editorController.title ?: @"",
        @"nativeViewTree": [self describeViewTree:self.editorController.view depth:0 maxDepth:5],
    };
}

- (WKWebView * _Nullable)findWebViewInView:(UIView *)view
{
    if ([view isKindOfClass:[WKWebView class]])
        return (WKWebView *) view;

    for (UIView *subview in view.subviews)
    {
        WKWebView *match = [self findWebViewInView:subview];

        if (match != nil)
            return match;
    }

    return nil;
}

- (NSDictionary<NSString *, id> *)describeViewTree:(UIView *)view
                                            depth:(NSInteger)depth
                                         maxDepth:(NSInteger)maxDepth
{
    NSMutableDictionary<NSString *, id> *result = [@{
        @"className": NSStringFromClass ([view class]) ?: @"UnknownView",
        @"hidden": @(view.hidden),
        @"alpha": @(view.alpha),
        @"subviewCount": @(view.subviews.count),
    } mutableCopy];

    if (depth >= maxDepth || view.subviews.count == 0)
        return result;

    NSMutableArray<NSDictionary<NSString *, id> *> *children = [[NSMutableArray alloc] initWithCapacity:view.subviews.count];

    for (UIView *subview in view.subviews)
        [children addObject:[self describeViewTree:subview depth:depth + 1 maxDepth:maxDepth]];

    result[@"children"] = children;
    return result;
}

- (void)collectEditorDOMMetricsAfterDelay:(NSTimeInterval)delay
                          remainingAttempts:(NSInteger)remainingAttempts
                                 completion:(CosimoHostResultBlock)completion
{
    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (delay * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self collectEditorDOMMetricsWithCompletion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
        {
            if (result != nil || remainingAttempts <= 0)
            {
                completion (result, error);
                return;
            }

            [self collectEditorDOMMetricsAfterDelay:0.25
                                  remainingAttempts:remainingAttempts - 1
                                         completion:completion];
        }];
    });
}

- (void)collectEditorDOMMetricsWithCompletion:(CosimoHostResultBlock)completion
{
    if (self.editorController == nil)
    {
        completion (nil, CosimoMakeError (18, @"The editor is not open."));
        return;
    }

    WKWebView *webView = [self findWebViewInView:self.editorController.view];

    if (webView == nil)
    {
        completion (nil, CosimoMakeError (19, @"Could not find the editor web view."));
        return;
    }

    NSString *script = @"typeof window.__cosimoCollectLayoutMetrics === 'function' ? window.__cosimoCollectLayoutMetrics() : null";

    [webView evaluateJavaScript:script completionHandler:^(id _Nullable result, NSError * _Nullable error)
    {
        if (error != nil)
        {
            completion (nil, error);
            return;
        }

        if ([result isKindOfClass:[NSDictionary class]])
        {
            completion ((NSDictionary<NSString *, id> *) result, nil);
            return;
        }

        if (result == nil || [result isKindOfClass:[NSNull class]])
        {
            completion (nil, CosimoMakeError (20, @"The editor did not expose layout metrics yet."));
            return;
        }

        completion (@{
            @"resultType": result != nil ? NSStringFromClass ([result class]) : @"nil",
        }, nil);
    }];
}

- (NSURL *)stateFileURLForName:(NSString *)stateName
{
    NSURL *documentsDirectory = [[[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory
                                                                        inDomains:NSUserDomainMask] firstObject];
    return [documentsDirectory URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.plist", stateName]];
}

- (NSDictionary<NSString *, id> *)readStateNamed:(NSString *)stateName
                                          source:(NSString * __autoreleasing _Nullable *)stateSource
                          verificationParameters:(NSDictionary<NSString *, NSNumber *> * __autoreleasing _Nullable *)verificationParameters
                                           error:(NSError **)error
{
    NSURL *url = [self stateFileURLForName:stateName];
    NSData *plist = [NSData dataWithContentsOfURL:url options:0 error:error];

    if (plist == nil)
        return nil;

    NSPropertyListFormat format = NSPropertyListBinaryFormat_v1_0;
    NSDictionary<NSString *, id> *dictionary =
        [NSPropertyListSerialization propertyListWithData:plist
                                                  options:NSPropertyListImmutable
                                                   format:&format
                                                    error:error];

    if (![dictionary isKindOfClass:[NSDictionary class]])
        return nil;

    id envelopeSource = dictionary[@"stateSource"];
    id envelopePayload = dictionary[@"statePayload"];
    id envelopeVerificationParameters = dictionary[@"verificationParameters"];

    if ([envelopeSource isKindOfClass:[NSString class]] && [envelopePayload isKindOfClass:[NSDictionary class]])
    {
        if (stateSource != nil)
            *stateSource = envelopeSource;

        if (verificationParameters != nil && [envelopeVerificationParameters isKindOfClass:[NSDictionary class]])
            *verificationParameters = envelopeVerificationParameters;

        return envelopePayload;
    }

    if (stateSource != nil)
        *stateSource = @"fullState";

    if (verificationParameters != nil)
        *verificationParameters = nil;

    return dictionary;
}

- (NSDictionary<NSString *, NSNumber *> *)currentVerificationParameters
{
    NSMutableDictionary<NSString *, NSNumber *> *values = [[NSMutableDictionary alloc] init];

    if (AUParameter *parameter = [self findParameterWithIdentifier:CosimoPrimaryParameterIdentifier])
        values[CosimoPrimaryParameterIdentifier] = @(parameter.value);

    if (AUParameter *parameter = [self findParameterWithIdentifier:CosimoTableSelectParameterIdentifier])
        values[CosimoTableSelectParameterIdentifier] = @(parameter.value);

    return values;
}

- (BOOL)verificationParameters:(NSDictionary<NSString *, NSNumber *> *)expectedParameters
              matchParameters:(NSDictionary<NSString *, NSNumber *> *)observedParameters
{
    if (expectedParameters.count == 0)
        return observedParameters.count > 0;

    for (NSString *identifier in expectedParameters)
    {
        NSNumber *expectedValue = expectedParameters[identifier];
        NSNumber *observedValue = observedParameters[identifier];

        if (expectedValue == nil || observedValue == nil)
            return NO;

        if (fabsf(expectedValue.floatValue - observedValue.floatValue) > CosimoStateVerificationTolerance)
            return NO;
    }

    return YES;
}

- (void)pollForRestoredVerificationParameters:(NSDictionary<NSString *, NSNumber *> *)verificationParameters
                                  stateSource:(NSString *)stateSource
                                     deadline:(CFTimeInterval)deadline
                                   completion:(CosimoHostResultBlock)completion
{
    NSDictionary<NSString *, NSNumber *> *observedParameters = [self currentVerificationParameters];
    const BOOL matches = [self verificationParameters:verificationParameters matchParameters:observedParameters];

    if (matches || CFAbsoluteTimeGetCurrent() >= deadline)
    {
        NSNumber *observedValue = observedParameters[CosimoPrimaryParameterIdentifier] ?: @(0.0f);
        NSNumber *observedTableSelectValue = observedParameters[CosimoTableSelectParameterIdentifier] ?: @(0.0f);

        completion (@{
            @"identifier": CosimoPrimaryParameterIdentifier,
            @"observedValue": observedValue,
            @"tableSelectIdentifier": CosimoTableSelectParameterIdentifier,
            @"observedTableSelectValue": observedTableSelectValue,
            @"stateSource": stateSource ?: @"fullState",
        }, nil);
        return;
    }

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.1 * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        [self pollForRestoredVerificationParameters:verificationParameters
                                        stateSource:stateSource
                                           deadline:deadline
                                         completion:completion];
    });
}

@end
