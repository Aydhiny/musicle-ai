// src/services/signalr.service.ts
import { AnalysisProgressUpdate } from "@/types/analysis.types";
import * as signalR from "@microsoft/signalr";

const HUB_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/hubs/analysis` : "https://localhost:5001/hubs/analysis";

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      console.log("SignalR already connected");
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Reconnection events
    this.connection.onreconnecting((error) => {
      console.log("SignalR reconnecting...", error);
    });

    this.connection.onreconnected((connectionId) => {
      console.log("SignalR reconnected:", connectionId);
      this.reconnectAttempts = 0;
    });

    this.connection.onclose(async (error) => {
      console.log("SignalR connection closed:", error);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        setTimeout(() => this.connect(), 5000);
      }
    });

    try {
      await this.connection.start();
      console.log("SignalR connected successfully");
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error("SignalR connection error:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      console.log("SignalR disconnected");
    }
  }

  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  onAnalysisCompleted(callback: (data: AnalysisProgressUpdate) => void): void {
    if (!this.connection) {
      throw new Error("SignalR not connected");
    }

    this.connection.on("AnalysisCompleted", callback);
  }

  offAnalysisCompleted(callback: (data: AnalysisProgressUpdate) => void): void {
    if (this.connection) {
      this.connection.off("AnalysisCompleted", callback);
    }
  }

  async subscribeToTrack(trackId: string): Promise<void> {
    if (!this.connection) {
      throw new Error("SignalR not connected");
    }

    try {
      await this.connection.invoke("SubscribeToTrack", trackId);
      console.log("Subscribed to track:", trackId);
    } catch (error) {
      console.error("Error subscribing to track:", error);
      throw error;
    }
  }

  async unsubscribeFromTrack(trackId: string): Promise<void> {
    if (!this.connection) {
      return;
    }

    try {
      await this.connection.invoke("UnsubscribeFromTrack", trackId);
      console.log("Unsubscribed from track:", trackId);
    } catch (error) {
      console.error("Error unsubscribing from track:", error);
    }
  }
}

export const signalRService = new SignalRService();
