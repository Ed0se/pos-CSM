import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService, HealthResponse } from './core/api/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private apiService = inject(ApiService);

  protected readonly health = signal<HealthResponse | null>(null);
  protected readonly isCheckingHealth = signal<boolean>(true);

  ngOnInit(): void {
    this.checkHealth();
  }

  checkHealth(): void {
    this.isCheckingHealth.set(true);
    this.apiService.getHealth().subscribe({
      next: (res) => {
        this.health.set(res);
        this.isCheckingHealth.set(false);
      },
      error: () => {
        this.health.set(null);
        this.isCheckingHealth.set(false);
      }
    });
  }
}
