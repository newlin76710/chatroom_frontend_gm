// RootErrorBoundary.jsx
// 包在整個 App 最外層，接住 React 渲染/生命週期中未被局部 AppErrorBoundary 擋下的錯誤，
// 顯示全頁友善提示而不是任由畫面卡死或變成一片空白/黑屏
import { Component } from "react";

export default class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[RootErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            background: "#121212",
            color: "#fff",
            fontFamily: "Arial, sans-serif",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div style={{ fontSize: 18 }}>⚠️ 頁面發生錯誤</div>
          <div style={{ fontSize: 14, color: "#aaa" }}>
            請嘗試重新整理頁面；若持續發生，建議更新瀏覽器版本後再試一次
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              borderRadius: 4,
              border: "none",
              background: "#0d6efd",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            重新整理
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
