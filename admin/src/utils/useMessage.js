// 消息提示 Hook — 必须在 <AntApp> 内部使用
import { App } from 'antd';

export function useMessage() {
  const { message } = App.useApp();
  return message;
}
