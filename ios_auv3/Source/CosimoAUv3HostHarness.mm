#import "CosimoAUv3HostHarness.h"

#import <AVFoundation/AVFoundation.h>
#import <AudioToolbox/AudioToolbox.h>
#import <CoreAudioKit/AUViewController.h>

static NSString * const CosimoHostHarnessErrorDomain = @"CosimoHostHarnessError";
static NSString * const CosimoPrimaryParameterIdentifier = @"wavetablePosition";
static NSString * const CosimoTableSelectParameterIdentifier = @"wavetableSelect";

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
    description.componentSubType = CosimoFourCC ("CmDv");
    description.componentManufacturer = CosimoFourCC ("Manu");
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
                    completion (nil, discoverError ?: error);
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

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.25 * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        const uint8_t noteOff[] = { 0x80, 60, 0 };
        midiBlock (AUEventSampleTimeImmediate, 0, 3, noteOff);
    });

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.7 * NSEC_PER_SEC)),
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
        completion ([self currentEditorMetrics:YES], nil);
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

            dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.8 * NSEC_PER_SEC)),
                            dispatch_get_main_queue(), ^
            {
                completion ([self currentEditorMetrics:YES], nil);
            });
        });
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

    if (fullState == nil)
    {
        completion (nil, CosimoMakeError (18, [NSString stringWithFormat:@"The AUv3 did not provide a persistable state dictionary. %@", [self describePersistableStateAvailability]]));
        return;
    }

    NSDictionary<NSString *, id> *stateEnvelope = @{
        @"stateSource": stateSource ?: @"fullState",
        @"statePayload": fullState,
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
    NSDictionary<NSString *, id> *savedState = [self readStateNamed:stateName source:&stateSource error:nil];

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

        [self applySavedState:savedState source:stateSource completion:completion];
    }];
}

- (void)loadSavedStateNamed:(NSString *)stateName completion:(CosimoHostResultBlock)completion
{
    NSString *stateSource = nil;
    NSDictionary<NSString *, id> *savedState = [self readStateNamed:stateName source:&stateSource error:nil];

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

            [self applySavedState:savedState source:stateSource completion:completion];
        }];

        return;
    }

    [self applySavedState:savedState source:stateSource completion:completion];
}

- (void)teardown
{
    [self closeEditorWithCompletion:nil];
    [self teardownAudioOnly];
}

#pragma mark - Internals

- (void)applySavedState:(NSDictionary<NSString *, id> *)savedState
                 source:(NSString *)stateSource
             completion:(CosimoHostResultBlock)completion
{
    if ([stateSource isEqualToString:@"parameterValues"])
    {
        NSError *parameterError = nil;

        if (! [self applyParameterValues:savedState error:&parameterError])
        {
            completion (nil, parameterError ?: CosimoMakeError (23, @"Could not restore the saved parameter values."));
            return;
        }
    }
    else if ([stateSource isEqualToString:@"fullStateForDocument"])
        self.instrumentUnit.AUAudioUnit.fullStateForDocument = savedState;
    else
        self.instrumentUnit.AUAudioUnit.fullState = savedState;

    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.25 * NSEC_PER_SEC)),
                    dispatch_get_main_queue(), ^
    {
        AUParameter *parameter = [self findParameterWithIdentifier:CosimoPrimaryParameterIdentifier];
        AUParameter *tableSelectParameter = [self findParameterWithIdentifier:CosimoTableSelectParameterIdentifier];

        if (parameter == nil || tableSelectParameter == nil)
        {
            completion (nil, CosimoMakeError (23, @"Could not find the restored wavetable parameters after restoring state."));
            return;
        }

        completion (@{
            @"identifier": CosimoPrimaryParameterIdentifier,
            @"observedValue": @(parameter.value),
            @"tableSelectIdentifier": CosimoTableSelectParameterIdentifier,
            @"observedTableSelectValue": @(tableSelectParameter.value),
        }, nil);
    });
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
    NSDictionary<NSString *, id> *parameterValues = [self serialiseParameterValues];

    if (parameterValues.count > 0)
    {
        if (stateSource != nil)
            *stateSource = @"parameterValues";

        return parameterValues;
    }

    NSDictionary<NSString *, id> *documentState = self.instrumentUnit.AUAudioUnit.fullStateForDocument;

    if (documentState != nil)
    {
        if (stateSource != nil)
            *stateSource = @"fullStateForDocument";

        return documentState;
    }

    NSDictionary<NSString *, id> *presetState = self.instrumentUnit.AUAudioUnit.fullState;

    if (presetState != nil)
    {
        if (stateSource != nil)
            *stateSource = @"fullState";

        return presetState;
    }

    if (stateSource != nil)
        *stateSource = nil;

    return nil;
}

- (NSDictionary<NSString *, id> *)serialiseParameterValues
{
    NSMutableDictionary<NSString *, NSNumber *> *values = [[NSMutableDictionary alloc] init];

    for (AUParameter *parameter in self.instrumentUnit.AUAudioUnit.parameterTree.allParameters)
    {
        if (parameter.identifier.length == 0)
            continue;

        values[parameter.identifier] = @(parameter.value);
    }

    return values;
}

- (BOOL)applyParameterValues:(NSDictionary<NSString *, id> *)parameterValues error:(NSError **)error
{
    for (NSString *identifier in parameterValues)
    {
        AUParameter *parameter = [self findParameterWithIdentifier:identifier];

        if (parameter == nil)
        {
            if (error != nil)
                *error = CosimoMakeError (24, [NSString stringWithFormat:@"Could not find parameter %@ while restoring state.", identifier]);

            return NO;
        }

        id savedValue = parameterValues[identifier];

        if (! [savedValue isKindOfClass:[NSNumber class]])
        {
            if (error != nil)
                *error = CosimoMakeError (25, [NSString stringWithFormat:@"Saved value for %@ was not numeric.", identifier]);

            return NO;
        }

        parameter.value = [savedValue floatValue];
    }

    return YES;
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
    NSArray<AVAudioUnitComponent *> *components = [manager componentsMatchingDescription:description];

    if (components.count > 0)
        return components;

    return [manager componentsPassingTest:^ BOOL (AVAudioUnitComponent *component, BOOL *stop)
    {
        AudioComponentDescription candidate = component.audioComponentDescription;
        BOOL isMusicDevice = candidate.componentType == description.componentType;
        BOOL subtypeMatches = candidate.componentSubType == description.componentSubType;
        BOOL manufacturerMatches = candidate.componentManufacturer == description.componentManufacturer;
        BOOL namedCosimo = [component.name localizedCaseInsensitiveContainsString:@"Cosimo"];

        return isMusicDevice && ((subtypeMatches && manufacturerMatches) || namedCosimo);
    }];
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
    [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];
    [[AVAudioSession sharedInstance] setActive:YES error:nil];

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
    [self.engine attachNode:audioUnit];
    [self.engine connect:audioUnit to:self.engine.mainMixerNode format:nil];

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

    return @{
        @"opened": @(opened),
        @"preferredWidth": @(preferredSize.width),
        @"preferredHeight": @(preferredSize.height),
        @"containerWidth": @(containerSize.width),
        @"containerHeight": @(containerSize.height),
        @"viewWidth": @(viewSize.width),
        @"viewHeight": @(viewSize.height),
    };
}

- (NSURL *)stateFileURLForName:(NSString *)stateName
{
    NSURL *documentsDirectory = [[[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory
                                                                        inDomains:NSUserDomainMask] firstObject];
    return [documentsDirectory URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.plist", stateName]];
}

- (NSDictionary<NSString *, id> *)readStateNamed:(NSString *)stateName
                                          source:(NSString * __autoreleasing _Nullable *)stateSource
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

    if ([envelopeSource isKindOfClass:[NSString class]] && [envelopePayload isKindOfClass:[NSDictionary class]])
    {
        if (stateSource != nil)
            *stateSource = envelopeSource;

        return envelopePayload;
    }

    if (stateSource != nil)
        *stateSource = @"fullState";

    return dictionary;
}

@end
