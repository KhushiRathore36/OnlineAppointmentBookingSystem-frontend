import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AppointmentApiService } from './appointment-api.service';
import { AppointmentRequest } from './models';

describe('AppointmentApiService', () => {
  let service: AppointmentApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppointmentApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AppointmentApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('books an appointment with the expected request body', () => {
    const payload: AppointmentRequest = {
      patientId: 10,
      providerId: 20,
      slotId: 30,
      serviceType: 'Consultation',
      notes: 'Routine checkup',
      modeOfConsultation: 'IN_PERSON'
    };

    service.bookAppointment(payload).subscribe();

    const request = httpMock.expectOne('/api/appointments');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({});
  });

  it('loads appointments by patient id', () => {
    service.getByPatient(10).subscribe((appointments) => {
      expect(appointments.length).toBe(1);
    });

    const request = httpMock.expectOne('/api/appointments/patient/10');
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 1 }]);
  });

  it('cancels appointments through the cancel endpoint', () => {
    service.cancel(55).subscribe();

    const request = httpMock.expectOne('/api/appointments/55/cancel');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({});
    request.flush({});
  });
});
