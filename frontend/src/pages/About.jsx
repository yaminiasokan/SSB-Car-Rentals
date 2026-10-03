import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Award, Users, Wrench } from 'lucide-react';
import { PageHeader, Plate } from '../components/ui';
import { COMPANY } from '../utils/constants';

export default function About() {
  return (
    <>
      <PageHeader eyebrow="About us" title="SSB Car Rentals">Your journey, our wheels — a local rental company built on reliability, fair pricing and being there when you need us.</PageHeader>
      <div className="container section-tight">
        <div className="grid grid-2" style={{ alignItems: 'center' }}>
          <div>
            <h2>Rentals done <span className="gold-text">properly</span></h2>
            <p className="muted">SSB CAR RENTALS serves Coimbatore and Tirupattur with a focused fleet — Swift Dzire, Baleno, Glanza, Ertiga and Innova Crysta — chosen for comfort, fuel economy and dependability.</p>
            <p className="muted">We keep things simple: transparent prices with every charge shown up front, cars that are photo-inspected before and after each trip, and a phone that is answered around the clock.</p>
            <p>Founder &amp; CEO — <strong className="gold">{COMPANY.ceo}</strong></p>
            <div className="row-wrap"><Link to="/cars" className="btn btn-gold">View our cars</Link><Link to="/contact" className="btn btn-outline">Contact us</Link></div>
          </div>
          <div className="card card-gold stack">
            <div className="row"><MapPin className="gold" /><span>Coimbatore &amp; Tirupattur</span></div>
            <div className="row"><Clock className="gold" /><span>Available 24x7</span></div>
            <div className="row"><Phone className="gold" /><Plate>{COMPANY.phone}</Plate></div>
            <div className="row"><Mail className="gold" /><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></div>
          </div>
        </div>
        <div className="grid grid-3 mt-3">
          {[[Award, 'Fair & transparent', 'No hidden charges and no security deposit. GST and extras are always itemised.'], [Wrench, 'Well maintained', 'Regular servicing and a documented condition check for every rental.'], [Users, 'People first', 'Real humans on the phone, day or night — including for emergencies.']].map(([I, t, d]) => (
            <div className="card card-hover" key={t}><I size={28} className="gold" /><h3 style={{ marginTop: 10 }}>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>
          ))}
        </div>
      </div>
    </>
  );
}
