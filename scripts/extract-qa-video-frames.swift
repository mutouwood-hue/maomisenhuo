import Foundation
import AVFoundation
import ImageIO
import UniformTypeIdentifiers
let args = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
for value in args.dropFirst(3) {
    let seconds = Double(value)!
    var actual = CMTime.zero
    let frame = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: &actual)
    let target = URL(fileURLWithPath: args[2]).appendingPathComponent("frame-\(value).png")
    let destination = CGImageDestinationCreateWithURL(target as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, frame, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Frame save failed") }
    print("requested=\(seconds) actual=\(actual.seconds) \(target.path)")
}
