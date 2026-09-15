import { Link } from 'react-router-dom';
import HowToList from '../components/HowToList';

function Cta({ href, tone = 'grad', children }) {
  const className = (tone === 'check' ? 'or-check' : 'or-grad') + ' inline-flex mt-8 text-white font-semibold px-5 py-3 rounded-[12px] no-underline';
  if (/^(https?:|mailto:)/i.test(href)) {
    return <a href={href} className={className}>{children}</a>;
  }
  return <Link to={href} className={className}>{children}</Link>;
}

function Shell({ kicker, title, lead, children, cta, href, tone = 'grad' }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">{kicker}</p>
      <h1 className="font-display font-bold text-3xl tracking-tight mb-4">{title}</h1>
      <p className="text-muted text-sm max-w-2xl mb-8">{lead}</p>
      {children}
      {cta && href && <Cta href={href} tone={tone}>{cta}</Cta>}
    </div>
  );
}

export function NewsPage() {
  return (
    <Shell kicker="Robotics News" title="Signal from the robot economy" lead="Platform launches, used-market liquidity, and the service stack that makes ownership bankable." href="/" cta="Open the live marketplace">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="border border-line rounded-or-sm p-4 bg-white"><h3 className="font-display font-semibold mb-2">Used humanoids need a market</h3><p className="text-sm text-muted">Exact SKU. Condition grades. Certification.</p></div>
        <div className="border border-line rounded-or-sm p-4 bg-white"><h3 className="font-display font-semibold mb-2">Attach is the margin</h3><p className="text-sm text-muted">Finance, warranty, and service on every build.</p></div>
        <div className="border border-line rounded-or-sm p-4 bg-white"><h3 className="font-display font-semibold mb-2">Huntington Beach</h3><p className="text-sm text-muted">Authorized distribution plus a public resale book.</p></div>
      </div>
    </Shell>
  );
}

export function PartnersPage() {
  return (
    <Shell kicker="Partners" title="Build in the US. Scale in Vietnam. Sell everywhere." lead="North American distribution plus a used-robot aftermarket. Incentives for partners who list and take back units by SKU." href="mailto:hello@theofficialrobot.com?subject=Partnership%20Inquiry" cta="Talk partnerships">
      <h2 className="font-display font-semibold text-xl mt-2">United States</h2>
      <p className="text-muted mt-2">Huntington Beach HQ. Channel, financing, warranty, and service for US buyers.</p>
      <h2 className="font-display font-semibold text-xl mt-6">Vietnam</h2>
      <p className="text-muted mt-2">Manufacturing and technology partnership for cost, speed, and export.</p>
    </Shell>
  );
}

export function FinancingPage() {
  return (
    <Shell kicker="Financing" title="Acquire the platform. Spread the capital." lead="Spread plus fee. Request terms on any configured build — new or used." href="/" cta="Request financing on a listing">
      <ul className="list-disc pl-5 text-muted space-y-2">
        <li>Financing CTA on every listing.</li>
        <li>Used and CPO attach the same way as new.</li>
        <li>Quote confirms landed cost. Catalog prices are estimates.</li>
      </ul>
    </Shell>
  );
}

export function ServicePage() {
  return (
    <Shell kicker="Service & repair" title="Support that continues after delivery" lead="We service platforms sold here so used units stay in the fleet." href="mailto:hello@theofficialrobot.com?subject=Service%20and%20Repair" cta="Book service">
      <p className="text-muted">Hands and end-effectors are parts — listed by exact SKU, not as a peer of Humanoid.</p>
    </Shell>
  );
}

export function WarrantyPage() {
  return (
    <Shell kicker="Extended warranties" title="Protect the asset. Keep it liquid." lead="Manufacturer first, then Official Robot Protection Plans at 10 / 17 / 24% of configuration." href="/" cta="Shop listings">
      <ul className="list-disc pl-5 text-muted space-y-2">
        <li>1 year — 10%</li>
        <li>2 years — 17%</li>
        <li>3 years — 24% (lab default)</li>
      </ul>
    </Shell>
  );
}

export function SellLanding() {
  return (
    <Shell kicker="Sell · used-robot liquidity" title="List by exact model. Not “robot dog.”" lead="Pick a catalog SKU or add a unique platform, grade condition, publish." href="/add" cta="List a robot" tone="check">
      <HowToList />
    </Shell>
  );
}
