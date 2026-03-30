#import "CosimoHostViewController.h"

#import "CosimoAUv3HostHarness.h"

static NSString * const CosimoSmokeStateName = @"host-smoke-state";

@interface CosimoHostViewController ()

@property (nonatomic, strong) CosimoAUv3HostHarness *harness;
@property (nonatomic, strong) UILabel *statusLabel;
@property (nonatomic, strong) UITextView *logView;
@property (nonatomic, strong) UISlider *parameterSlider;
@property (nonatomic, strong) UILabel *parameterValueLabel;
@property (nonatomic, strong) UISlider *tableSelectSlider;
@property (nonatomic, strong) UILabel *tableSelectValueLabel;
@property (nonatomic, strong) UIView *editorOverlayView;
@property (nonatomic, strong) UIView *editorContentView;
@property (nonatomic, assign) BOOL automationStarted;

@end

@implementation CosimoHostViewController

- (void)viewDidLoad
{
    [super viewDidLoad];

    self.view.backgroundColor = [UIColor colorWithRed:0.04 green:0.06 blue:0.12 alpha:1.0];
    self.title = @"Cosimo AUv3 Host";

    [self buildInterface];
    self.harness = [[CosimoAUv3HostHarness alloc] initWithHostViewController:self
                                                           editorContainerView:self.editorContentView];
}

- (void)viewDidAppear:(BOOL)animated
{
    [super viewDidAppear:animated];
    [self runAutomationIfNeeded];
}

- (void)dealloc
{
    [self.harness teardown];
}

#pragma mark - UI

- (void)buildInterface
{
    UIScrollView *scrollView = [[UIScrollView alloc] init];
    scrollView.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:scrollView];

    UIView *contentView = [[UIView alloc] init];
    contentView.translatesAutoresizingMaskIntoConstraints = NO;
    [scrollView addSubview:contentView];

    UIStackView *stack = [[UIStackView alloc] init];
    stack.translatesAutoresizingMaskIntoConstraints = NO;
    stack.axis = UILayoutConstraintAxisVertical;
    stack.spacing = 14.0;
    [contentView addSubview:stack];

    self.statusLabel = [[UILabel alloc] init];
    self.statusLabel.numberOfLines = 0;
    self.statusLabel.textColor = [UIColor colorWithRed:0.96 green:0.86 blue:0.67 alpha:1.0];
    self.statusLabel.font = [UIFont preferredFontForTextStyle:UIFontTextStyleHeadline];
    self.statusLabel.text = @"Discover the AUv3, open its editor, play a note, then save and reload state.";
    [stack addArrangedSubview:self.statusLabel];

    [stack addArrangedSubview:[self buttonRowWithTitles:@[
        @"Discover",
        @"Instantiate",
        @"Play Note",
    ] selectors:@[
        NSStringFromSelector(@selector(discoverTapped)),
        NSStringFromSelector(@selector(instantiateTapped)),
        NSStringFromSelector(@selector(playNoteTapped)),
    ]]];

    [stack addArrangedSubview:[self buttonRowWithTitles:@[
        @"Open Editor",
        @"Close Editor",
        @"Save State",
    ] selectors:@[
        NSStringFromSelector(@selector(openEditorTapped)),
        NSStringFromSelector(@selector(closeEditorTapped)),
        NSStringFromSelector(@selector(saveStateTapped)),
    ]]];

    [stack addArrangedSubview:[self buttonRowWithTitles:@[
        @"Reload State",
        @"Run Smoke",
    ] selectors:@[
        NSStringFromSelector(@selector(reloadStateTapped)),
        NSStringFromSelector(@selector(runSmokeTapped)),
    ]]];

    UILabel *sliderLabel = [[UILabel alloc] init];
    sliderLabel.text = @"Wavetable Position";
    sliderLabel.textColor = [UIColor colorWithRed:0.82 green:0.85 blue:0.96 alpha:1.0];
    [stack addArrangedSubview:sliderLabel];

    UIStackView *sliderRow = [[UIStackView alloc] init];
    sliderRow.axis = UILayoutConstraintAxisHorizontal;
    sliderRow.spacing = 12.0;
    sliderRow.alignment = UIStackViewAlignmentCenter;

    self.parameterSlider = [[UISlider alloc] init];
    self.parameterSlider.minimumValue = 0.0f;
    self.parameterSlider.maximumValue = 1.0f;
    self.parameterSlider.value = 0.0f;
    [self.parameterSlider addTarget:self action:@selector(parameterSliderChanged:) forControlEvents:UIControlEventValueChanged];

    self.parameterValueLabel = [[UILabel alloc] init];
    self.parameterValueLabel.text = @"0.000";
    self.parameterValueLabel.textColor = [UIColor colorWithRed:0.96 green:0.86 blue:0.67 alpha:1.0];
    self.parameterValueLabel.font = [UIFont monospacedDigitSystemFontOfSize:14.0 weight:UIFontWeightMedium];

    [sliderRow addArrangedSubview:self.parameterSlider];
    [sliderRow addArrangedSubview:self.parameterValueLabel];
    [stack addArrangedSubview:sliderRow];

    UILabel *tableSliderLabel = [[UILabel alloc] init];
    tableSliderLabel.text = @"Wavetable Select";
    tableSliderLabel.textColor = [UIColor colorWithRed:0.82 green:0.85 blue:0.96 alpha:1.0];
    [stack addArrangedSubview:tableSliderLabel];

    UIStackView *tableSliderRow = [[UIStackView alloc] init];
    tableSliderRow.axis = UILayoutConstraintAxisHorizontal;
    tableSliderRow.spacing = 12.0;
    tableSliderRow.alignment = UIStackViewAlignmentCenter;

    self.tableSelectSlider = [[UISlider alloc] init];
    self.tableSelectSlider.minimumValue = 0.0f;
    self.tableSelectSlider.maximumValue = 255.0f;
    self.tableSelectSlider.value = 0.0f;
    [self.tableSelectSlider addTarget:self action:@selector(tableSelectSliderChanged:) forControlEvents:UIControlEventValueChanged];

    self.tableSelectValueLabel = [[UILabel alloc] init];
    self.tableSelectValueLabel.text = @"0";
    self.tableSelectValueLabel.textColor = [UIColor colorWithRed:0.96 green:0.86 blue:0.67 alpha:1.0];
    self.tableSelectValueLabel.font = [UIFont monospacedDigitSystemFontOfSize:14.0 weight:UIFontWeightMedium];

    [tableSliderRow addArrangedSubview:self.tableSelectSlider];
    [tableSliderRow addArrangedSubview:self.tableSelectValueLabel];
    [stack addArrangedSubview:tableSliderRow];

    self.logView = [[UITextView alloc] init];
    self.logView.editable = NO;
    self.logView.scrollEnabled = NO;
    self.logView.backgroundColor = [UIColor colorWithRed:0.08 green:0.1 blue:0.16 alpha:1.0];
    self.logView.textColor = [UIColor colorWithRed:0.85 green:0.88 blue:0.98 alpha:1.0];
    self.logView.font = [UIFont monospacedSystemFontOfSize:13.0 weight:UIFontWeightRegular];
    self.logView.text = @"Host ready.\n";
    self.logView.layer.cornerRadius = 14.0;
    [stack addArrangedSubview:self.logView];

    self.editorOverlayView = [[UIView alloc] init];
    self.editorOverlayView.translatesAutoresizingMaskIntoConstraints = NO;
    self.editorOverlayView.backgroundColor = [UIColor colorWithWhite:0.02 alpha:0.95];
    self.editorOverlayView.hidden = YES;
    [self.view addSubview:self.editorOverlayView];

    UILabel *editorLabel = [[UILabel alloc] init];
    editorLabel.translatesAutoresizingMaskIntoConstraints = NO;
    editorLabel.text = @"Cosimo Synth Editor";
    editorLabel.textColor = [UIColor whiteColor];
    editorLabel.font = [UIFont preferredFontForTextStyle:UIFontTextStyleHeadline];
    [self.editorOverlayView addSubview:editorLabel];

    UIButton *closeOverlayButton = [self makeButtonWithTitle:@"Close Editor" selector:@selector(closeEditorTapped)];
    closeOverlayButton.translatesAutoresizingMaskIntoConstraints = NO;
    [self.editorOverlayView addSubview:closeOverlayButton];

    self.editorContentView = [[UIView alloc] init];
    self.editorContentView.translatesAutoresizingMaskIntoConstraints = NO;
    [self.editorOverlayView addSubview:self.editorContentView];

    UILayoutGuide *safeArea = self.view.safeAreaLayoutGuide;

    [NSLayoutConstraint activateConstraints:@[
        [scrollView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [scrollView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [scrollView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
        [scrollView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor],

        [contentView.leadingAnchor constraintEqualToAnchor:scrollView.contentLayoutGuide.leadingAnchor],
        [contentView.trailingAnchor constraintEqualToAnchor:scrollView.contentLayoutGuide.trailingAnchor],
        [contentView.topAnchor constraintEqualToAnchor:scrollView.contentLayoutGuide.topAnchor],
        [contentView.bottomAnchor constraintEqualToAnchor:scrollView.contentLayoutGuide.bottomAnchor],
        [contentView.widthAnchor constraintEqualToAnchor:scrollView.frameLayoutGuide.widthAnchor],

        [stack.leadingAnchor constraintEqualToAnchor:contentView.leadingAnchor constant:16.0],
        [stack.trailingAnchor constraintEqualToAnchor:contentView.trailingAnchor constant:-16.0],
        [stack.topAnchor constraintEqualToAnchor:contentView.topAnchor constant:16.0],
        [stack.bottomAnchor constraintEqualToAnchor:contentView.bottomAnchor constant:-20.0],

        [self.logView.heightAnchor constraintGreaterThanOrEqualToConstant:240.0],

        [self.editorOverlayView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
        [self.editorOverlayView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
        [self.editorOverlayView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
        [self.editorOverlayView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor],

        [editorLabel.leadingAnchor constraintEqualToAnchor:self.editorOverlayView.leadingAnchor constant:20.0],
        [editorLabel.topAnchor constraintEqualToAnchor:self.editorOverlayView.safeAreaLayoutGuide.topAnchor constant:12.0],

        [closeOverlayButton.trailingAnchor constraintEqualToAnchor:self.editorOverlayView.trailingAnchor constant:-20.0],
        [closeOverlayButton.centerYAnchor constraintEqualToAnchor:editorLabel.centerYAnchor],

        [self.editorContentView.leadingAnchor constraintEqualToAnchor:self.editorOverlayView.leadingAnchor],
        [self.editorContentView.trailingAnchor constraintEqualToAnchor:self.editorOverlayView.trailingAnchor],
        [self.editorContentView.topAnchor constraintEqualToAnchor:editorLabel.bottomAnchor constant:12.0],
        [self.editorContentView.bottomAnchor constraintEqualToAnchor:self.editorOverlayView.bottomAnchor],
    ]];
}

- (UIStackView *)buttonRowWithTitles:(NSArray<NSString *> *)titles selectors:(NSArray<NSString *> *)selectors
{
    UIStackView *row = [[UIStackView alloc] init];
    row.axis = UILayoutConstraintAxisHorizontal;
    row.spacing = 10.0;
    row.distribution = UIStackViewDistributionFillEqually;

    for (NSUInteger index = 0; index < titles.count; ++index)
    {
        SEL selector = NSSelectorFromString (selectors[index]);
        [row addArrangedSubview:[self makeButtonWithTitle:titles[index] selector:selector]];
    }

    return row;
}

- (UIButton *)makeButtonWithTitle:(NSString *)title selector:(SEL)selector
{
    UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
    [button setTitle:title forState:UIControlStateNormal];
    [button addTarget:self action:selector forControlEvents:UIControlEventTouchUpInside];
    button.backgroundColor = [UIColor colorWithRed:0.2 green:0.27 blue:0.5 alpha:1.0];
    [button setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    button.layer.cornerRadius = 12.0;
    button.contentEdgeInsets = UIEdgeInsetsMake (12.0, 14.0, 12.0, 14.0);
    return button;
}

#pragma mark - Manual actions

- (void)discoverTapped
{
    [self.harness discoverExtensionWithCompletion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        [self handleStepNamed:@"discover" result:result error:error];
    }];
}

- (void)instantiateTapped
{
    [self.harness instantiateExtensionWithCompletion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        [self handleStepNamed:@"instantiate" result:result error:error];
    }];
}

- (void)playNoteTapped
{
    [self.harness sendTestNoteWithCompletion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        [self handleStepNamed:@"play note" result:result error:error];
    }];
}

- (void)openEditorTapped
{
    [self presentEditorOverlay:YES];
    [self.harness openEditorWithCompletion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        [self handleStepNamed:@"open editor" result:result error:error];
    }];
}

- (void)closeEditorTapped
{
    [self.harness closeEditorWithCompletion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        [self presentEditorOverlay:NO];
        [self handleStepNamed:@"close editor" result:result error:error];
    }];
}

- (void)saveStateTapped
{
    [self.harness saveStateNamed:CosimoSmokeStateName completion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        [self handleStepNamed:@"save state" result:result error:error];
    }];
}

- (void)reloadStateTapped
{
    [self.harness reloadStateNamed:CosimoSmokeStateName completion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        [self handleStepNamed:@"reload state" result:result error:error];
    }];
}

- (void)runSmokeTapped
{
    [self runSaveSmokeWithOutputName:nil completion:nil];
}

- (void)parameterSliderChanged:(UISlider *)slider
{
    self.parameterValueLabel.text = [NSString stringWithFormat:@"%.3f", slider.value];

    [self.harness setParameterWithIdentifier:@"wavetablePosition" value:slider.value completion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        [self handleStepNamed:@"set parameter" result:result error:error];
    }];
}

- (void)tableSelectSliderChanged:(UISlider *)slider
{
    float quantizedValue = roundf (slider.value);
    slider.value = quantizedValue;
    self.tableSelectValueLabel.text = [NSString stringWithFormat:@"%.0f", quantizedValue];

    [self.harness setParameterWithIdentifier:@"wavetableSelect" value:quantizedValue completion:^(NSDictionary<NSString *,id> * _Nullable result, NSError * _Nullable error)
    {
        [self handleStepNamed:@"set table" result:result error:error];
    }];
}

#pragma mark - Automation

- (void)runAutomationIfNeeded
{
    if (self.automationStarted)
        return;

    NSDictionary<NSString *, NSString *> *environment = NSProcessInfo.processInfo.environment;
    NSString *mode = environment[@"COSIMO_SMOKE_MODE"];

    if (mode.length == 0)
        return;

    self.automationStarted = YES;
    NSString *outputName = environment[@"COSIMO_SMOKE_OUTPUT_NAME"] ?: @"host-smoke.json";

    if ([mode isEqualToString:@"save"])
    {
        [self runSaveSmokeWithOutputName:outputName completion:nil];
        return;
    }

    if ([mode isEqualToString:@"reload"])
    {
        [self runReloadSmokeWithOutputName:outputName];
        return;
    }

    if ([mode isEqualToString:@"layout"])
    {
        [self runLayoutSmokeWithOutputName:outputName];
        return;
    }

    [self completeAutomationWithPayload:@{ @"error": [NSString stringWithFormat:@"Unknown automation mode: %@", mode] }
                              outputName:outputName];
}

- (void)runSaveSmokeWithOutputName:(NSString * _Nullable)outputName
                        completion:(void (^ _Nullable)(NSDictionary<NSString *, id> *payload))completion
{
    NSMutableDictionary<NSString *, id> *payload = [[NSMutableDictionary alloc] init];

    [self setStatus:@"Discovering the Cosimo AUv3…"];
    [self.harness discoverExtensionWithCompletion:^(NSDictionary<NSString *,id> * _Nullable discoverResult, NSError * _Nullable discoverError)
    {
        if ([self handleAutomationError:discoverError outputName:outputName])
            return;

        payload[@"discover"] = discoverResult;

        [self setStatus:@"Instantiating the AUv3 in our host app…"];
        [self.harness instantiateExtensionWithCompletion:^(NSDictionary<NSString *,id> * _Nullable instantiateResult, NSError * _Nullable instantiateError)
        {
            if ([self handleAutomationError:instantiateError outputName:outputName])
                return;

            payload[@"instantiate"] = instantiateResult;
            payload[@"parameters"] = self.harness.parameterSnapshot ?: @[];
            [self presentEditorOverlay:YES];

            [self.harness openEditorWithCompletion:^(NSDictionary<NSString *,id> * _Nullable editorResult, NSError * _Nullable editorError)
            {
                if ([self handleAutomationError:editorError outputName:outputName])
                    return;

                NSMutableDictionary<NSString *, id> *editorPayload = [editorResult mutableCopy];

                dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.35 * NSEC_PER_SEC)),
                                dispatch_get_main_queue(), ^
                {
                    [self.harness setParameterWithIdentifier:@"wavetablePosition" value:0.625f completion:^(NSDictionary<NSString *,id> * _Nullable parameterResult, NSError * _Nullable parameterError)
                    {
                        if ([self handleAutomationError:parameterError outputName:outputName])
                            return;

                        payload[@"parameterSet"] = parameterResult;

                        [self.harness setParameterWithIdentifier:@"wavetableSelect" value:1.0f completion:^(NSDictionary<NSString *,id> * _Nullable tableResult, NSError * _Nullable tableError)
                        {
                            if ([self handleAutomationError:tableError outputName:outputName])
                                return;

                            payload[@"tableSelectionSet"] = tableResult;

                            dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (3.0 * NSEC_PER_SEC)),
                                            dispatch_get_main_queue(), ^
                            {
                                [self.harness sendTestNoteWithCompletion:^(NSDictionary<NSString *,id> * _Nullable noteResult, NSError * _Nullable noteError)
                                {
                                    if ([self handleAutomationError:noteError outputName:outputName])
                                        return;

                                    payload[@"audio"] = noteResult;

                                    [self.harness closeEditorWithCompletion:^(NSDictionary<NSString *,id> * _Nullable closeResult, NSError * _Nullable closeError)
                                    {
                                        [self presentEditorOverlay:NO];

                                        if ([self handleAutomationError:closeError outputName:outputName])
                                            return;

                                        editorPayload[@"closed"] = closeResult[@"closed"] ?: @YES;
                                        payload[@"editor"] = editorPayload;

                                        [self.harness saveStateNamed:CosimoSmokeStateName completion:^(NSDictionary<NSString *,id> * _Nullable saveResult, NSError * _Nullable saveError)
                                        {
                                            if ([self handleAutomationError:saveError outputName:outputName])
                                                return;

                                            [self.harness reloadStateNamed:CosimoSmokeStateName completion:^(NSDictionary<NSString *,id> * _Nullable reloadResult, NSError * _Nullable reloadError)
                                            {
                                                if ([self handleAutomationError:reloadError outputName:outputName])
                                                    return;

                                                payload[@"state"] = @{
                                                    @"savedStateKeys": saveResult[@"savedStateKeys"] ?: @[],
                                                    @"reloadObservedValue": reloadResult[@"observedValue"] ?: @(0.0),
                                                    @"reloadObservedTableSelect": reloadResult[@"observedTableSelectValue"] ?: @(0.0),
                                                };

                                                [self setStatus:@"The host app discovered the AUv3, opened the editor, played a note, and restored state."];
                                                [self appendLogWithName:@"save smoke" value:payload];

                                                if (outputName != nil)
                                                    [self completeAutomationWithPayload:payload outputName:outputName];

                                                if (completion != nil)
                                                    completion (payload);
                                            }];
                                        }];
                                    }];
                                }];
                            });
                        }];
                    }];
                });
            }];
        }];
    }];
}

- (void)runReloadSmokeWithOutputName:(NSString *)outputName
{
    NSMutableDictionary<NSString *, id> *payload = [[NSMutableDictionary alloc] init];

    [self.harness discoverExtensionWithCompletion:^(NSDictionary<NSString *,id> * _Nullable discoverResult, NSError * _Nullable discoverError)
    {
        if ([self handleAutomationError:discoverError outputName:outputName])
            return;

        payload[@"discover"] = discoverResult;

        [self.harness instantiateExtensionWithCompletion:^(NSDictionary<NSString *,id> * _Nullable instantiateResult, NSError * _Nullable instantiateError)
        {
            if ([self handleAutomationError:instantiateError outputName:outputName])
                return;

            payload[@"instantiate"] = instantiateResult;
            payload[@"parameters"] = self.harness.parameterSnapshot ?: @[];

            [self.harness loadSavedStateNamed:CosimoSmokeStateName completion:^(NSDictionary<NSString *,id> * _Nullable reloadResult, NSError * _Nullable reloadError)
            {
                if ([self handleAutomationError:reloadError outputName:outputName])
                    return;

                payload[@"state"] = @{
                    @"relaunchObservedValue": reloadResult[@"observedValue"] ?: @(0.0),
                    @"relaunchObservedTableSelect": reloadResult[@"observedTableSelectValue"] ?: @(0.0),
                };

                [self completeAutomationWithPayload:payload outputName:outputName];
            }];
        }];
    }];
}

- (void)runLayoutSmokeWithOutputName:(NSString *)outputName
{
    NSMutableDictionary<NSString *, id> *payload = [[NSMutableDictionary alloc] init];

    [self.harness discoverExtensionWithCompletion:^(NSDictionary<NSString *,id> * _Nullable discoverResult, NSError * _Nullable discoverError)
    {
        if ([self handleAutomationError:discoverError outputName:outputName])
            return;

        payload[@"discover"] = discoverResult;

        [self.harness instantiateExtensionWithCompletion:^(NSDictionary<NSString *,id> * _Nullable instantiateResult, NSError * _Nullable instantiateError)
        {
            if ([self handleAutomationError:instantiateError outputName:outputName])
                return;

            payload[@"instantiate"] = instantiateResult;
            [self presentEditorOverlay:YES];

            [self.harness openEditorWithCompletion:^(NSDictionary<NSString *,id> * _Nullable editorResult, NSError * _Nullable editorError)
            {
                if ([self handleAutomationError:editorError outputName:outputName])
                    return;

                NSMutableDictionary<NSString *, id> *editorPayload = [editorResult mutableCopy];

                dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (2.5 * NSEC_PER_SEC)),
                                dispatch_get_main_queue(), ^
                {
                    [self.harness closeEditorWithCompletion:^(NSDictionary<NSString *,id> * _Nullable closeResult, NSError * _Nullable closeError)
                    {
                        [self presentEditorOverlay:NO];

                        if ([self handleAutomationError:closeError outputName:outputName])
                            return;

                        editorPayload[@"closed"] = closeResult[@"closed"] ?: @YES;
                        payload[@"editor"] = editorPayload;
                        [self completeAutomationWithPayload:payload outputName:outputName];
                    }];
                });
            }];
        }];
    }];
}

- (BOOL)handleAutomationError:(NSError * _Nullable)error outputName:(NSString * _Nullable)outputName
{
    if (error == nil)
        return NO;

    NSString *message = error.localizedDescription ?: @"Unknown host automation error";
    [self setStatus:message];
    [self appendLog:message];

    if (outputName != nil)
        [self completeAutomationWithPayload:@{ @"error": message } outputName:outputName];

    return YES;
}

- (void)completeAutomationWithPayload:(NSDictionary<NSString *, id> *)payload
                           outputName:(NSString *)outputName
{
    NSError *jsonError = nil;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:payload options:NSJSONWritingPrettyPrinted error:&jsonError];

    if (jsonData == nil)
    {
        [self appendLog:[NSString stringWithFormat:@"Could not encode automation payload: %@", jsonError.localizedDescription]];
        return;
    }

    NSURL *documentsDirectory = [[[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory
                                                                        inDomains:NSUserDomainMask] firstObject];
    NSURL *outputURL = [documentsDirectory URLByAppendingPathComponent:outputName];
    NSError *writeError = nil;

    if (! [jsonData writeToURL:outputURL options:NSDataWritingAtomic error:&writeError])
    {
        [self appendLog:[NSString stringWithFormat:@"Could not write %@: %@", outputName, writeError.localizedDescription]];
        return;
    }

    [self appendLog:[NSString stringWithFormat:@"Wrote %@", outputURL.lastPathComponent]];
}

#pragma mark - Logging

- (void)handleStepNamed:(NSString *)name result:(NSDictionary<NSString *, id> * _Nullable)result error:(NSError * _Nullable)error
{
    if (error != nil)
    {
        [self setStatus:error.localizedDescription];
        [self appendLog:error.localizedDescription];
        return;
    }

    [self setStatus:[NSString stringWithFormat:@"Finished %@.", name]];
    [self appendLogWithName:name value:result];
}

- (void)setStatus:(NSString *)status
{
    self.statusLabel.text = status;
}

- (void)appendLog:(NSString *)message
{
    NSString *existingText = self.logView.text ?: @"";
    self.logView.text = [existingText stringByAppendingFormat:@"%@\n", message];
    NSRange tail = NSMakeRange (self.logView.text.length, 0);
    [self.logView scrollRangeToVisible:tail];
}

- (void)appendLogWithName:(NSString *)name value:(NSDictionary<NSString *, id> * _Nullable)value
{
    NSError *error = nil;
    NSData *json = [NSJSONSerialization dataWithJSONObject:value ?: @{} options:NSJSONWritingPrettyPrinted error:&error];

    if (json == nil)
    {
        [self appendLog:[NSString stringWithFormat:@"%@: %@", name, error.localizedDescription]];
        return;
    }

    NSString *jsonText = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding] ?: @"{}";
    [self appendLog:[NSString stringWithFormat:@"%@:\n%@", name, jsonText]];
}

- (void)presentEditorOverlay:(BOOL)visible
{
    self.editorOverlayView.hidden = ! visible;
}

@end
