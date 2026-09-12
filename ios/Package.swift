// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "WakeAlarmCore",
  platforms: [.macOS(.v13), .iOS(.v15)],
  targets: [
    .target(name: "WakeAlarmCore", path: "Core"),
    .testTarget(name: "WakeAlarmCoreTests", dependencies: ["WakeAlarmCore"], path: "Tests/WakeAlarmCoreTests"),
  ]
)
