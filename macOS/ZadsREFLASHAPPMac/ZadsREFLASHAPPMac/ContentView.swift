import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View { ReflashWebView() }
}

struct ReflashWebView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: config)
        view.load(URLRequest(url: AppConfig.appURL, cachePolicy: .reloadRevalidatingCacheData))
        return view
    }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
