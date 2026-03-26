#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^CosimoHostResultBlock)(NSDictionary<NSString *, id> * _Nullable result, NSError * _Nullable error);

@interface CosimoAUv3HostHarness : NSObject

@property (nonatomic, strong, readonly, nullable) NSDictionary<NSString *, id> *lastDiscoverySummary;
@property (nonatomic, strong, readonly, nullable) NSArray<NSDictionary<NSString *, id> *> *parameterSnapshot;

- (instancetype)initWithHostViewController:(UIViewController *)hostViewController
                         editorContainerView:(UIView *)editorContainerView;

- (void)discoverExtensionWithCompletion:(CosimoHostResultBlock)completion;
- (void)instantiateExtensionWithCompletion:(CosimoHostResultBlock)completion;
- (void)setParameterWithIdentifier:(NSString *)identifier
                             value:(float)value
                        completion:(CosimoHostResultBlock)completion;
- (void)sendTestNoteWithCompletion:(CosimoHostResultBlock)completion;
- (void)openEditorWithCompletion:(CosimoHostResultBlock)completion;
- (void)closeEditorWithCompletion:(CosimoHostResultBlock _Nullable)completion;
- (void)saveStateNamed:(NSString *)stateName completion:(CosimoHostResultBlock)completion;
- (void)reloadStateNamed:(NSString *)stateName completion:(CosimoHostResultBlock)completion;
- (void)loadSavedStateNamed:(NSString *)stateName completion:(CosimoHostResultBlock)completion;
- (void)teardown;

@end

NS_ASSUME_NONNULL_END
