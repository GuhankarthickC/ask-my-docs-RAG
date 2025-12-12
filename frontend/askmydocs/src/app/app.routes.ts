import { Routes } from '@angular/router';
import { DocumentComponent } from './components/document/document.component';
import { HomeComponent } from './components/home/home.component';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent) },
    { path: 'chat', loadComponent: () => import('./components/chat/chat.component').then(m => m.ChatComponent) },
    { path: 'documents', loadComponent: () => import('./components/document/document.component').then(m => m.DocumentComponent) },
    { path: '**', redirectTo: '' }
];
