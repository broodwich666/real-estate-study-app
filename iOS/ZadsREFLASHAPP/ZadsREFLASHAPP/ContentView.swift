import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View { ReflashWebView().ignoresSafeArea() }
}

struct ReflashWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        let prefs = WKWebpagePreferences(); prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.load(URLRequest(url: AppConfig.appURL, cachePolicy: .reloadRevalidatingCacheData))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {}
}
