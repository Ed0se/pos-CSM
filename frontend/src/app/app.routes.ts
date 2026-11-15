import { Routes } from '@angular/router';
import { PosComponent } from './features/pos/pos.component';
import { ProductsComponent } from './features/products/products.component';
import { InventoryComponent } from './features/inventory/inventory.component';
import { SalesComponent } from './features/sales/sales.component';

export const routes: Routes = [
  { path: 'pos', component: PosComponent, title: 'Punto de Venta - Colegio San Miguel' },
  { path: 'articulos', component: ProductsComponent, title: 'Artículos - Colegio San Miguel' },
  { path: 'inventario', component: InventoryComponent, title: 'Inventario - Colegio San Miguel' },
  { path: 'ventas', component: SalesComponent, title: 'Ventas - Colegio San Miguel' },
  { path: '', redirectTo: 'pos', pathMatch: 'full' },
  { path: '**', redirectTo: 'pos' }
];
