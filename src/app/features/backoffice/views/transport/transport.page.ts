import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TransportService, TransportItem, RessourceTransport } from '../../services/transport.service';

@Component({ selector: 'app-transport-page', standalone: true, imports: [CommonModule, FormsModule], template: `
<section class="container-fluid py-4"><header class="mb-4"><h1>Transport</h1><p class="text-secondary">Signalements et indisponibilités des ressources.</p></header>
@if(error()){<div class="alert alert-danger" role="alert">{{error()}}</div>} @if(success()){<div class="alert alert-success" role="status">{{success()}}</div>}
<div class="row g-4"><div class="col-12 col-xl-6"><article class="card"><div class="card-body"><h2 class="h4">Signaler un incident</h2><form (ngSubmit)="submitSignalement()" class="row g-3">
<div class="col-sm-6"><label class="form-label">Type</label><select class="form-select" name="incidentType" [(ngModel)]="incident.type"><option>RETARD</option><option>PANNE</option><option>ABSENCE</option><option>IMPOSSIBILITE</option><option>INDISPONIBILITE</option></select></div>
<div class="col-sm-6"><label class="form-label">Ressource</label><select class="form-select" name="incidentResource" [(ngModel)]="incident.resource"><option value="CHAUFFEUR">Chauffeur</option><option value="VEHICULE">Véhicule</option></select></div>
<div class="col-sm-6"><label class="form-label">ID ressource</label><input class="form-control" type="number" min="1" name="incidentId" [(ngModel)]="incident.id" required></div>
@if(incident.resource==='VEHICULE'){<div class="col-sm-6"><label class="form-label">ID course affectée</label><input class="form-control" type="number" min="1" name="courseId" [(ngModel)]="incident.courseId" required></div>}
<div class="col-12"><label class="form-label">Détails</label><textarea class="form-control" rows="3" maxlength="1000" name="details" [(ngModel)]="incident.details" required></textarea></div>
<div class="col-12"><button class="btn btn-primary" [disabled]="busy()">Envoyer le signalement</button></div></form></div></article>
<article class="card mt-4"><div class="card-body"><h2 class="h4">Déclarer une indisponibilité</h2><form (ngSubmit)="submitIndispo()" class="row g-3">
<div class="col-sm-6"><label class="form-label">Ressource</label><select class="form-select" name="availabilityResource" [(ngModel)]="availability.resource"><option value="CHAUFFEUR">Chauffeur</option><option value="VEHICULE">Véhicule</option></select></div>
<div class="col-sm-6"><label class="form-label">ID ressource</label><input class="form-control" type="number" min="1" name="availabilityId" [(ngModel)]="availability.id" required></div>
<div class="col-sm-6"><label class="form-label">Version actuelle de la ressource</label><input class="form-control" type="number" min="0" name="resourceVersion" [(ngModel)]="availability.version" required></div>
<div class="col-sm-6"><label class="form-label">Début</label><input class="form-control" type="datetime-local" name="start" [(ngModel)]="availability.start" required></div>
<div class="col-sm-6"><label class="form-label">Fin estimée (facultatif)</label><input class="form-control" type="datetime-local" name="end" [(ngModel)]="availability.end"></div>
<div class="col-12"><label class="form-label">Motif</label><textarea class="form-control" rows="2" maxlength="1000" name="reason" [(ngModel)]="availability.reason" required></textarea></div>
<div class="col-12"><button class="btn btn-primary" [disabled]="busy()">Enregistrer l’indisponibilité</button></div></form></div></article></div>
<div class="col-12 col-xl-6"><article class="card"><div class="card-body"><div class="d-flex justify-content-between"><h2 class="h4">Indisponibilités ouvertes</h2><button class="btn btn-outline-secondary btn-sm" type="button" (click)="reload()">Actualiser</button></div>@if(availabilityItems().length){<div class="table-responsive"><table class="table"><thead><tr><th>Ressource</th><th>Motif</th><th>Début</th><th>Fin estimée</th></tr></thead><tbody>@for(x of availabilityItems();track x.id){<tr><td>{{x.type_ressource}} #{{x.ressource_id}}</td><td>{{x.motif}}</td><td>{{x.debut_a | date:'short'}}</td><td>{{x.fin_estimee_a ? (x.fin_estimee_a | date:'short') : '—'}}</td></tr>}</tbody></table></div>}@else{<p class="text-secondary">Aucune indisponibilité ouverte.</p>}</div></article>
<article class="card mt-4"><div class="card-body"><h2 class="h4">Signalements récents</h2>@if(reports().length){<div class="table-responsive"><table class="table"><thead><tr><th>Date</th><th>Incident</th><th>Ressource</th><th>Détails</th></tr></thead><tbody>@for(x of reports();track x.id){<tr><td>{{x.signale_a | date:'short'}}</td><td>{{x.type}}</td><td>{{x.type_ressource}} #{{x.ressource_id}}</td><td>{{x.details}}</td></tr>}</tbody></table></div>}@else{<p class="text-secondary">Aucun signalement.</p>}</div></article></div></div></section>` })
export class TransportPage implements OnInit {
 private readonly api=inject(TransportService); protected readonly reports=signal<TransportItem[]>([]); protected readonly availabilityItems=signal<TransportItem[]>([]); protected readonly error=signal(''); protected readonly success=signal(''); protected readonly busy=signal(false);
 protected incident:{type:string;resource:RessourceTransport;id:number|null;courseId:number|null;details:string}={type:'PANNE',resource:'CHAUFFEUR',id:null,courseId:null,details:''};
 protected availability:{resource:RessourceTransport;id:number|null;version:number;start:string;end:string;reason:string}={resource:'CHAUFFEUR',id:null,version:0,start:'',end:'',reason:''};
 ngOnInit(){this.reload();} protected reload(){this.error.set('');this.api.signalements().subscribe({next:r=>this.reports.set(r.data??[]),error:e=>this.fail(e)});this.api.indisponibilites().subscribe({next:r=>this.availabilityItems.set(r.data??[]),error:e=>this.fail(e)});}
 protected submitSignalement(){if(!this.incident.id||!this.incident.details.trim()||(this.incident.resource==='VEHICULE'&&!this.incident.courseId))return;this.run(this.api.signaler({type:this.incident.type,type_ressource:this.incident.resource,ressource_id:this.incident.id,...(this.incident.resource==='VEHICULE'?{course_id:this.incident.courseId!}:{}),details:this.incident.details.trim()}));}
 protected submitIndispo(){if(!this.availability.id||!this.availability.start||!this.availability.reason.trim())return;this.run(this.api.indisponibilite({type_ressource:this.availability.resource,ressource_id:this.availability.id,version_ressource_attendue:this.availability.version,debut_a:new Date(this.availability.start).toISOString(),fin_estimee_a:this.availability.end?new Date(this.availability.end).toISOString():null,motif:this.availability.reason.trim()}));}
 private run(req:Observable<unknown>){this.busy.set(true);this.error.set('');req.subscribe({next:()=>{this.busy.set(false);this.success.set('Enregistré.');this.reload();},error:(e:HttpErrorResponse)=>{this.busy.set(false);this.fail(e)}});}
 private fail(e:HttpErrorResponse){this.error.set(e.error?.message||'Échec de la communication avec l’API Transport.');}
}
