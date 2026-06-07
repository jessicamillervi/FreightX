type ClientCallback = (data: string) => void;

class IoTStreamHub {
  private clients: Set<ClientCallback> = new Set();

  subscribe(callback: ClientCallback): () => void {
    this.clients.add(callback);
    return () => {
      this.clients.delete(callback);
    };
  }

  publish(data: unknown) {
    const payload = JSON.stringify(data);
    this.clients.forEach((callback) => {
      try {
        callback(payload);
      } catch (err) {
        console.error('Failed to notify stream client:', err);
      }
    });
  }
}

const globalRef = global as unknown as { iotStreamHub?: IoTStreamHub };
if (!globalRef.iotStreamHub) {
  globalRef.iotStreamHub = new IoTStreamHub();
}
export const iotStreamHub = globalRef.iotStreamHub;
