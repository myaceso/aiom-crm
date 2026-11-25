export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: "auth" | "provider" | "invalid"
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type ImageGenInput = {
  prompt: string;
  aspectRatio: string;
};

export type VideoGenInput = {
  prompt: string;
  aspectRatio: string;
  durationSec: number;
  referenceUrl?: string;
};

export type VideoSubmit = {
  providerJobId: string;
  statusUrl: string;
  responseUrl: string;
  readyAt?: number;
};

export type VideoPoll =
  | { state: "pending"; phase: "queued" | "running"; queuePosition?: number }
  | { state: "failed"; error: string }
  | { state: "succeeded"; bytes?: Buffer; url?: string; mime: string };
