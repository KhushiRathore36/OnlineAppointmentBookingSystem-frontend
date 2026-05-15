import { Routes } from '@angular/router';

import { AuthPageComponent } from './pages/auth.page';
import { CheckoutPageComponent } from './pages/checkout.page';
import { DashboardPageComponent } from './pages/dashboard.page';
import { DiscoverPageComponent } from './pages/discover.page';
import { HomePageComponent } from './pages/home.page';
import { ReviewPageComponent } from './pages/review.page';
import { SelectRolePageComponent } from './pages/select-role.page';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'discover', component: DiscoverPageComponent },
  { path: 'checkout', component: CheckoutPageComponent },
  { path: 'review', component: ReviewPageComponent },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: 'select-role', component: SelectRolePageComponent },
  { path: 'login', redirectTo: 'auth', pathMatch: 'full' },
  { path: 'auth', component: AuthPageComponent },
  { path: '**', redirectTo: '' }
];
