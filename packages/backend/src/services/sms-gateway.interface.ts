/**
 * SMS Gateway interface for sending OTP messages.
 * Abstracted for testability — implementations can be swapped
 * (real provider vs mock for testing).
 */

export interface SmsDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsGateway {
  /**
   * Send an OTP code to the given phone number.
   * @param phone - The 10-digit Indian mobile number (without country code)
   * @param code - The 6-digit OTP code
   * @returns Result indicating success or failure of delivery
   */
  sendOtp(phone: string, code: string): Promise<SmsDeliveryResult>;
}

/**
 * Default SMS gateway implementation using an external HTTP API.
 * In production, this would call the actual SMS provider.
 */
export class HttpSmsGateway implements SmsGateway {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string
  ) {}

  async sendOtp(phone: string, code: string): Promise<SmsDeliveryResult> {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          to: `+91${phone}`,
          message: `Your OTP for UP Police Test Series is: ${code}. Valid for 5 minutes. Do not share this code.`,
          templateId: "otp_verification",
        }),
        signal: AbortSignal.timeout(10_000), // 10-second timeout per requirement 2.1
      });

      if (!response.ok) {
        return {
          success: false,
          error: `SMS API returned status ${response.status}`,
        };
      }

      const data = (await response.json()) as { messageId?: string };
      return {
        success: true,
        messageId: data.messageId,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown SMS delivery error";
      return {
        success: false,
        error: message,
      };
    }
  }
}

/**
 * No-op SMS gateway for development/testing. Always succeeds and logs OTP to console.
 */
export class MockSmsGateway implements SmsGateway {
  public readonly sentMessages: Array<{ phone: string; code: string }> = [];

  async sendOtp(phone: string, code: string): Promise<SmsDeliveryResult> {
    this.sentMessages.push({ phone, code });
    console.log(`\n📱 [DEV OTP] Phone: +91${phone} → OTP: ${code}\n`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }
}
