// Local AppKit SVG rasterization into explicit pixels; no browser or device.
import AppKit
let input=CommandLine.arguments[1],output=CommandLine.arguments[2],size=Int(CommandLine.arguments[3])!
guard let image=NSImage(contentsOfFile:input),let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0) else{fatalError("SVG/bitmap unavailable")}
NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:rep);NSColor.clear.setFill();NSRect(x:0,y:0,width:size,height:size).fill();image.draw(in:NSRect(x:0,y:0,width:size,height:size),from:.zero,operation:.sourceOver,fraction:1);NSGraphicsContext.restoreGraphicsState()
try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:output))
