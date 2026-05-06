export type UserRole = 'PATIENT' | 'PROVIDER' | 'ADMIN';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED';

export interface AuthResponse {
  token: string;
  message: string;
}

export interface UserProfile {
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  provider?: string;
  active?: boolean;
  profilePicUrl?: string;
  createdAt?: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface Provider {
  providerId: number;
  userId: number;
  specialization: string;
  qualification: string;
  experienceYears: number;
  bio: string;
  clinicName: string;
  clinicAddress: string;
  avgRating: number;
  verified: boolean;
  available: boolean;
  createdAt?: string;
}

export interface ProviderRequest {
  userId: number;
  specialization: string;
  qualification: string;
  experienceYears: number;
  bio: string;
  clinicName: string;
  clinicAddress: string;
}

export interface ProviderView extends Provider {
  displayName: string;
  initials: string;
  accent: string;
  shortQualification: string;
  experienceLabel: string;
}

export interface AvailabilitySlot {
  slotId: number;
  providerId: number;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: SlotStatus;
  recurrence: string;
  createdAt?: string;
}

export interface SlotRequest {
  providerId: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  recurrence: string;
}

export interface Appointment {
  appointmentId: number;
  patientId: number;
  providerId: number;
  slotId: number;
  serviceType: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  modeOfConsultation: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppointmentRequest {
  patientId: number;
  providerId: number;
  slotId: number;
  serviceType: string;
  notes: string;
  modeOfConsultation: string;
}

export interface Review {
  reviewId: number;
  appointmentId: number;
  patientId: number;
  providerId: number;
  rating: number;
  comment: string;
  reviewDate: string;
  verified: boolean;
  anonymous: boolean;
}

export interface ReviewRequest {
  appointmentId: number;
  patientId: number;
  providerId: number;
  rating: number;
  comment: string;
  anonymous: boolean;
}

export interface MedicalRecord {
  recordId: number;
  appointmentId: number;
  patientId: number;
  providerId: number;
  diagnosis: string;
  prescription: string;
  notes: string;
  attachmentUrl?: string;
  followUpDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicalRecordRequest {
  appointmentId: number;
  patientId: number;
  providerId: number;
  diagnosis: string;
  prescription: string;
  notes: string;
  attachmentUrl?: string;
  followUpDate?: string;
}

export interface Payment {
  paymentId: number;
  appointmentId: number;
  patientId: number;
  amount: number;
  status: string;
  mode: string;
  transactionId?: string;
  currency?: string;
  paidAt?: string;
  refundedAt?: string;
  notes?: string;
  gateway?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
}

export interface CreateOrderRequest {
  appointmentId: number;
  patientId: number;
  amount: number;
  currency?: string;
  notes?: string;
}

export interface CreateOrderResponse {
  paymentId: number;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentRequest {
  appointmentId: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

const palette = [
  'linear-gradient(135deg, #6c5dff, #9e8cff)',
  'linear-gradient(135deg, #ff9776, #ffc07f)',
  'linear-gradient(135deg, #39bda7, #78e3d0)',
  'linear-gradient(135deg, #ff7c9d, #ffc4d2)'
];

export function toProviderView(provider: Provider): ProviderView {
  const source = (provider.specialization || provider.clinicName || 'Doctor').trim();
  const title = source.split(/\s+/).slice(0, 2).join(' ');
  const initials = title
    .split(' ')
    .map((segment) => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    ...provider,
    displayName: `Dr. ${title} Specialist`,
    initials: initials || 'DR',
    accent: palette[provider.providerId % palette.length],
    shortQualification: provider.qualification || 'Trusted medical professional',
    experienceLabel: `${provider.experienceYears || 0}+ years experience`
  };
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

export function formatTime(value: string): string {
  const [hours = '00', minutes = '00'] = value.split(':');
  const hour = Number(hours);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 || 12;
  return `${normalized}:${minutes} ${suffix}`;
}
