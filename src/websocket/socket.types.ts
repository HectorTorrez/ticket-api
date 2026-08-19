export interface InventorySocketData {
  userId?: string;
  role?: string;
}

declare module 'socket.io' {
  interface SocketData {
    userId?: string;
    role?: string;
  }
}
