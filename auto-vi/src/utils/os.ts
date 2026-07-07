import * as os from 'os';

export function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address; // 返回第一个非回环IPv4，如 192.168.1.xxx
      }
    }
  }
  return 'localhost';
}