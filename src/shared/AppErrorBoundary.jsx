// AppErrorBoundary.jsx
// 通用錯誤邊界，防止局部元件錯誤炸掉整個頁面
// 用法：<AppErrorBoundary label="管理面板"><AdminToolPanel /></AppErrorBoundary>
import { Component } from "react";
import { autoReloadOnError } from "./autoReload";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[AppErrorBoundary] ${this.props.label || "區塊"}錯誤:`, error, info);
    // 出錯直接自動重整（最常見是改版後舊分頁載不到新 chunk），重整後會跳「連線到期」提示
    if (autoReloadOnError()) this.setState({ reloading: true });
  }

  render() {
    if (this.state.hasError) {
      if (this.state.reloading) {
        return (
          <div style={{ padding: "8px 12px", color: "#ccc", fontSize: 13, background: "#1a1a1a", borderRadius: 4 }}>
            🔄 連線到期，正在自動重整頁面…
          </div>
        );
      }
      return (
        <div style={{ padding: "8px 12px", color: "#f88", fontSize: 13, background: "#1a1a1a", borderRadius: 4 }}>
          ⚠️ {this.props.label || "此區塊"}發生錯誤，請重新整理頁面
        </div>
      );
    }
    return this.props.children;
  }
}
