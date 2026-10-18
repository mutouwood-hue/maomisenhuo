import AppKit
import WebKit
import Foundation
// Software fixture only: unattached, nonpersistent WebKit; no browser/device UI.
final class PageRunner: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var web: WKWebView!
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard JSONSerialization.isValidJSONObject(m.body), let data=try? JSONSerialization.data(withJSONObject:m.body,options:[.prettyPrinted,.sortedKeys]) else { exit(2) }
        try? data.write(to:URL(fileURLWithPath:CommandLine.arguments[2]))
        guard let r=m.body as? [String:Any], r["pass"] as? Bool == true else { exit(1) }
        guard CommandLine.arguments.count>5 else { exit(0) }
        web.takeSnapshot(with:nil) { image,error in
            guard let image=image, let tiff=image.tiffRepresentation, let rep=NSBitmapImageRep(data:tiff), let png=rep.representation(using:.png,properties:[:]) else { fputs("snapshot unavailable: \(String(describing:error))\n",stderr);exit(2) }
            do { let target=URL(fileURLWithPath:CommandLine.arguments[5]);try png.write(to:target.deletingPathExtension().appendingPathExtension("bottom.png"))
                self.web.evaluateJavaScript("document.querySelectorAll('#sc-hbody,#m-sheet-body,.offline-device-body').forEach(n=>n.scrollTop=0)") { _,_ in
                    DispatchQueue.main.asyncAfter(deadline:.now()+0.05) { self.web.takeSnapshot(with:nil) { top,err in
                        guard let t=top?.tiffRepresentation,let r=NSBitmapImageRep(data:t),let p=r.representation(using:.png,properties:[:]) else { exit(2) };do {try p.write(to:target);exit(0)}catch {exit(2)}
                    }}
                } } catch { fputs("\(error)\n",stderr);exit(2) }
        }
    }
    func start() throws {
        let config=WKWebViewConfiguration();config.websiteDataStore = .nonPersistent();config.userContentController.add(self,name:"result")
        let width=Double(CommandLine.arguments[3])!,height=Double(CommandLine.arguments[4])!
        web=WKWebView(frame:NSRect(x:0,y:0,width:width,height:height),configuration:config);web.navigationDelegate=self
        web.loadHTMLString(try String(contentsOfFile:CommandLine.arguments[1],encoding:.utf8),baseURL:nil)
        DispatchQueue.main.asyncAfter(deadline:.now()+30) { self.web.evaluateJavaScript("JSON.stringify({stage:window.__refreshStage,ready:document.readyState,scripts:document.scripts.length,frames:window.__frames?.length})") { value,error in fputs("page fixture timeout: \(String(describing:value)) \(String(describing:error))\n",stderr);exit(2) } }
    }
}
_ = NSApplication.shared
let runner=PageRunner()
do { try runner.start();RunLoop.main.run() } catch { fputs("\(error)\n",stderr);exit(2) }
