import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AppointmentApiService } from '../core/appointment-api.service';
import { AuthStore } from '../core/auth.store';
import { Appointment, ProviderView, Review, toProviderView } from '../core/models';
import { ProviderApiService } from '../core/provider-api.service';
import { ReviewApiService } from '../core/review-api.service';

@Component({
  selector: 'app-review-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './review.page.html',
  styleUrl: './review.page.scss'
})
export class ReviewPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly reviewApi = inject(ReviewApiService);
  private readonly providerApi = inject(ProviderApiService);

  protected appointment: Appointment | null = null;
  protected provider: ProviderView | null = null;
  protected existingReview: Review | null = null;
  protected state: 'loading' | 'ready' | 'submitting' | 'submitted' | 'error' = 'loading';
  protected message = '';
  protected draft = {
    rating: 5,
    comment: '',
    anonymous: false
  };

  async ngOnInit(): Promise<void> {
    const user = this.authStore.user();
    if (!user || user.role !== 'PATIENT') {
      await this.router.navigate(['/auth']);
      return;
    }

    const appointmentId = Number(this.route.snapshot.queryParamMap.get('appointmentId'));
    if (!appointmentId) {
      this.state = 'error';
      this.message = 'Review details are missing. Please open the appointment from your dashboard.';
      return;
    }

    try {
      const [appointment, reviews, providers] = await Promise.all([
        firstValueFrom(this.appointmentApi.getById(appointmentId)),
        firstValueFrom(this.reviewApi.getByPatient(user.userId)),
        firstValueFrom(this.providerApi.getProviders())
      ]);

      this.appointment = appointment;
      this.existingReview = reviews.find((review) => review.appointmentId === appointmentId) || null;
      this.provider = providers.map(toProviderView).find((provider) => provider.providerId === appointment.providerId) || null;
      this.state = 'ready';
      this.message = this.route.snapshot.queryParamMap.get('source') === 'payment'
        ? 'Payment complete. Review will unlock here once the appointment is marked completed.'
        : '';
    } catch (error: any) {
      this.state = 'error';
      this.message = error?.error?.message || 'The review step could not be loaded right now.';
    }
  }

  protected get canSubmitReview(): boolean {
    return !!this.appointment && this.isReviewAllowedStatus(this.appointment.status) && !this.existingReview;
  }

  protected get reviewLockedMessage(): string {
    if (!this.appointment) {
      return '';
    }
    if (this.existingReview) {
      return 'A review has already been submitted for this appointment.';
    }
    if (!this.isReviewAllowedStatus(this.appointment.status)) {
      return 'Review is only available once the appointment is completed.';
    }
    return '';
  }

  private isReviewAllowedStatus(status: Appointment['status']): boolean {
    return status === 'COMPLETED';
  }

  protected async submitReview(): Promise<void> {
    const user = this.authStore.user();
    if (!user || !this.appointment || !this.canSubmitReview) {
      return;
    }

    this.state = 'submitting';
    this.message = 'Submitting your review...';

    try {
      this.existingReview = await firstValueFrom(
        this.reviewApi.create({
          appointmentId: this.appointment.appointmentId,
          patientId: user.userId,
          providerId: this.appointment.providerId,
          rating: this.draft.rating,
          comment: this.draft.comment,
          anonymous: this.draft.anonymous
        })
      );

      this.state = 'submitted';
      this.message = 'Thank you. Your review has been submitted successfully.';
    } catch (error: any) {
      this.state = 'error';
      this.message = error?.error?.message || 'The review could not be submitted. Please try again later.';
    }
  }
}
