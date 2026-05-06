import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AppointmentApiService } from '../core/appointment-api.service';
import { AuthStore } from '../core/auth.store';
import { Appointment, CreateOrderResponse, ProviderView, toProviderView } from '../core/models';
import { PaymentApiService } from '../core/payment-api.service';
import { ProviderApiService } from '../core/provider-api.service';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
    };
  }
}

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
}

const RAZORPAY_SCRIPT_ID = 'razorpay-checkout-script';
const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

@Component({
  selector: 'app-checkout-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout.page.html',
  styleUrl: './checkout.page.scss'
})
export class CheckoutPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly paymentApi = inject(PaymentApiService);
  private readonly providerApi = inject(ProviderApiService);

  protected appointment: Appointment | null = null;
  protected provider: ProviderView | null = null;
  protected amountPaise = 0;
  protected serviceType = 'Consultation';
  protected state: 'loading' | 'ready' | 'processing' | 'paid' | 'error' = 'loading';
  protected message = '';

  async ngOnInit(): Promise<void> {
    const user = this.authStore.user();
    if (!user || user.role !== 'PATIENT') {
      await this.router.navigate(['/auth']);
      return;
    }

    const appointmentId = Number(this.route.snapshot.queryParamMap.get('appointmentId'));
    const amount = Number(this.route.snapshot.queryParamMap.get('amount'));
    this.serviceType = this.route.snapshot.queryParamMap.get('serviceType') || this.serviceType;

    if (!appointmentId || !amount) {
      this.state = 'error';
      this.message = 'Checkout details are missing. Please book the appointment again.';
      return;
    }

    this.amountPaise = amount;

    try {
      const appointment = await firstValueFrom(this.appointmentApi.getById(appointmentId));
      this.appointment = appointment;

      const providers = await firstValueFrom(this.providerApi.getProviders());
      this.provider = providers.map(toProviderView).find((provider) => provider.providerId === appointment.providerId) || null;

      this.state = 'ready';
      this.message = 'Your appointment is reserved. Complete the payment to confirm the checkout step.';
    } catch (error: any) {
      this.state = 'error';
      this.message = error?.error?.message || 'Checkout could not be prepared. Please try booking again.';
    }
  }

  protected get payableLabel(): string {
    return this.formatCurrency(this.amountPaise / 100);
  }

  protected async payNow(): Promise<void> {
    const user = this.authStore.user();
    if (!user || !this.appointment) {
      return;
    }

    this.state = 'processing';
    this.message = 'Creating your Razorpay order and opening checkout...';

    try {
      const order = await firstValueFrom(
        this.paymentApi.createOrder({
          appointmentId: this.appointment.appointmentId,
          patientId: user.userId,
          amount: this.amountPaise,
          currency: 'INR',
          notes: this.appointment.notes
        })
      );

      const scriptLoaded = await this.ensureRazorpayLoaded();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error('Secure payment gateway could not be loaded.');
      }

      await this.openRazorpayCheckout(order, this.appointment);
      this.state = 'paid';
      this.message = 'Payment successful. Taking you to the review step...';

      await this.router.navigate(['/review'], {
        queryParams: {
          appointmentId: this.appointment.appointmentId,
          source: 'payment'
        }
      });
    } catch (error: any) {
      this.state = 'error';
      this.message = error?.error?.message || error?.message || 'Payment could not be completed. Please try again.';
    }
  }

  protected async cancelBooking(): Promise<void> {
    if (!this.appointment) {
      await this.router.navigate(['/discover']);
      return;
    }

    this.state = 'processing';
    this.message = 'Cancelling your reserved appointment...';

    try {
      await firstValueFrom(this.appointmentApi.cancel(this.appointment.appointmentId));
      await this.router.navigate(['/discover']);
    } catch {
      this.state = 'error';
      this.message = 'The reserved appointment could not be cancelled right now. Please use your dashboard if needed.';
    }
  }

  private async openRazorpayCheckout(order: CreateOrderResponse, appointment: Appointment): Promise<void> {
    const profile = this.authStore.user();

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const checkout = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'MediBook',
        description: `${this.serviceType} with ${this.provider?.displayName ?? 'your doctor'}`,
        order_id: order.orderId,
        prefill: {
          name: profile?.fullName,
          email: profile?.email,
          contact: profile?.phone
        },
        notes: {
          appointmentId: String(appointment.appointmentId),
          providerId: String(appointment.providerId)
        },
        theme: {
          color: '#6c5dff'
        },
        modal: {
          ondismiss: () => {
            if (!settled) {
              settled = true;
              reject(new Error('Payment window was closed before completion.'));
            }
          }
        },
        handler: async (response) => {
          if (settled) {
            return;
          }

          try {
            await firstValueFrom(
              this.paymentApi.verifyPayment({
                appointmentId: appointment.appointmentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              })
            );
            settled = true;
            resolve();
          } catch (error) {
            settled = true;
            reject(error);
          }
        }
      });

      checkout.open();
    });
  }

  private ensureRazorpayLoaded(): Promise<boolean> {
    if (window.Razorpay) {
      return Promise.resolve(true);
    }

    const existingScript = document.getElementById(RAZORPAY_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      return new Promise((resolve) => {
        existingScript.addEventListener('load', () => resolve(true), { once: true });
        existingScript.addEventListener('error', () => resolve(false), { once: true });
      });
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.id = RAZORPAY_SCRIPT_ID;
      script.src = RAZORPAY_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  }
}
