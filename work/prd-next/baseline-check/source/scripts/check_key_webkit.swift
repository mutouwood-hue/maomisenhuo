import AppKit
import WebKit
import Foundation

// Nonpersistent, unattached WebKit layout fixture. No browser window or device.
final class Runner: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var web: WKWebView!
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard JSONSerialization.isValidJSONObject(m.body), let data = try? JSONSerialization.data(withJSONObject:m.body, options:[.prettyPrinted,.sortedKeys]) else { exit(2) }
        try? data.write(to:URL(fileURLWithPath:CommandLine.arguments[2]))
        if let r=m.body as? [String:Any], let ok=r["pass"] as? Bool { exit(ok ? 0 : 1) }
        exit(2)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fputs("\(error)\n",stderr);exit(2) }
    func start() throws {
        let config=WKWebViewConfiguration();config.websiteDataStore = .nonPersistent();config.userContentController.add(self,name:"result")
        web=WKWebView(frame:NSRect(x:0,y:0,width:360,height:640),configuration:config);web.navigationDelegate=self
        web.loadHTMLString(try String(contentsOfFile:CommandLine.arguments[1],encoding:.utf8),baseURL:nil)
        DispatchQueue.main.asyncAfter(deadline:.now()+30) { fputs("WebKit fixture timeout\n",stderr);exit(2) }
    }
}
_ = NSApplication.shared
let runner=Runner()
do { try runner.start();RunLoop.main.run() } catch { fputs("\(error)\n",stderr);exit(2) }
