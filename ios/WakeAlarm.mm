#import "WakeAlarm.h"

// ObjC++ cannot @import frameworks, so the generated Swift header needs this spelled out for the
// UNUserNotificationCenterDelegate the notification proxy conforms to.
#import <UserNotifications/UserNotifications.h>

#if __has_include("WakeAlarm-Swift.h")
#import "WakeAlarm-Swift.h"
#else
#import <WakeAlarm/WakeAlarm-Swift.h>
#endif

@implementation WakeAlarm {
  WakeAlarmImpl *_impl;
}

- (instancetype)init {
  if (self = [super init]) {
    _impl = [WakeAlarmImpl new];
    __weak WakeAlarm *weakSelf = self;
    _impl.onEvent = ^(NSString *name, NSDictionary<NSString *, id> *payload) {
      WakeAlarm *strongSelf = weakSelf;
      if (!strongSelf) return;
      if ([name isEqualToString:@"fired"]) [strongSelf emitOnFired:payload];
      else if ([name isEqualToString:@"stopped"]) [strongSelf emitOnStopped:payload];
      else if ([name isEqualToString:@"permissionChanged"]) [strongSelf emitOnPermissionChanged:payload];
    };
    [_impl start];
  }
  return self;
}

- (void)invalidate {
  [_impl stop];
}

- (void)schedule:(JS::NativeWakeAlarm::NativeAlarmInput &)input resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  NSMutableArray *days = [NSMutableArray new];
  for (double d : input.days()) [days addObject:@((int)d)];
  NSDictionary *dict = @{
    @"id": input.id_(), @"hour": @((int)input.hour()), @"minute": @((int)input.minute()), @"days": days,
    @"title": input.title(), @"body": input.body(), @"sound": input.sound(),
    @"payloadJson": input.payloadJson(), @"maxRingMs": @((int)input.maxRingMs()), @"vibrate": @(input.vibrate()),
  };
  [_impl schedule:dict completion:^(NSDictionary<NSString *, id> *result) { resolve(result); }];
}

- (void)cancel:(NSString *)id resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl cancel:id completion:^{ resolve(nil); }];
}

- (void)cancelAll:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl cancelAll:^{ resolve(nil); }];
}

- (void)getScheduled:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl getScheduled:^(NSArray<NSDictionary<NSString *, id> *> *rows) { resolve(rows); }];
}

- (void)getPermissionStatus:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl getPermissionStatus:^(NSDictionary<NSString *, id> *s) { resolve(s); }];
}

- (void)requestPermissions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl requestPermissions:^(NSDictionary<NSString *, id> *s) { resolve(s); }];
}

- (void)openSettings:(NSString *)kind resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl openSettings:kind completion:^{ resolve(nil); }];
}

- (NSString * _Nullable)getRingingJson { return [_impl getRingingJson]; }

- (void)stopRinging:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl stopRinging:^{ resolve(nil); }];
}

- (NSString * _Nullable)consumePendingActionJson { return [_impl consumePendingActionJson]; }

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeWakeAlarmSpecJSI>(params);
}

+ (NSString *)moduleName { return @"WakeAlarm"; }

@end
