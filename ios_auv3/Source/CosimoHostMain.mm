#import <UIKit/UIKit.h>

#import "CosimoHostViewController.h"

@interface CosimoHostAppDelegate : UIResponder <UIApplicationDelegate>

@property (nonatomic, strong) UIWindow *window;

@end

@implementation CosimoHostAppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    UINavigationController *navigationController =
        [[UINavigationController alloc] initWithRootViewController:[[CosimoHostViewController alloc] init]];
    self.window.rootViewController = navigationController;
    [self.window makeKeyAndVisible];
    return YES;
}

@end

int main (int argc, char * argv[])
{
    @autoreleasepool
    {
        return UIApplicationMain (argc, argv, nil, NSStringFromClass ([CosimoHostAppDelegate class]));
    }
}
