#import "WakeAlarm.h"

#if __has_include("WakeAlarm-Swift.h")
#import "WakeAlarm-Swift.h"
#else
#import <WakeAlarm/WakeAlarm-Swift.h>
#endif

@implementation WakeAlarm

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeWakeAlarmSpecJSI>(params);
}

+ (NSString *)moduleName { return @"WakeAlarm"; }

@end
