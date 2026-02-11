import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Privacy = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    // Check if we have a referrer from the same site, otherwise go to signup
    const referrer = document.referrer;
    const currentHost = window.location.host;
    
    if (referrer && referrer.includes(currentHost)) {
      // We came from another page on this site, go back
      navigate(-1);
    } else {
      // Opened directly or from external link, go to signup
      navigate('/signup');
    }
  };

  const Section = ({ title, children }) => (
    <div className="mb-6">
      <h2 className="text-brand-400 text-lg font-semibold mb-3">{title}</h2>
      <div className="text-gray-300 text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-appbg px-4 py-6">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="w-10 h-10 rounded-full bg-cardBg flex items-center justify-center text-white hover:bg-zinc-800 transition-colors mb-6"
        data-testid="back-button"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Logo */}
      <div className="text-center mb-8">
        <img 
          src="https://customer-assets.emergentagent.com/job_3f85dde5-1e91-4759-bd85-f441b993a550/artifacts/s4024gg5_Calendrax1.3%20Logo%20Opaque%20%282%29.png" 
          alt="Calendrax" 
          className="h-20 mx-auto"
          
        />
      </div>

      <div className="max-w-3xl mx-auto" data-testid="privacy-page">
        <h1 className="text-white text-3xl font-bold mb-6">Privacy Policy</h1>
        
        <div className="bg-cardBg border border-zinc-800 rounded-xl p-6">
          
          <Section title="1. Introduction">
            <p>Gareth Grey (Sole Trader) trading as Calendrax ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Calendrax platform.</p>
            <p>We comply with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. Please read this policy carefully to understand our practices regarding your personal data.</p>
          </Section>

          <Section title="2. Data Controller">
            <p>The data controller responsible for your personal data is:</p>
            <p className="mt-2">
              <strong className="text-white">Gareth Grey trading as Calendrax</strong><br />
              Email: support@calendrax.com
            </p>
          </Section>

          <Section title="3. Information We Collect">
            <p><strong className="text-white">Information you provide directly:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Account information (name, email address, phone number, password)</li>
              <li>Profile information (business name, address, description, photos)</li>
              <li>Booking details (appointments, services selected, preferences)</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Communications with us or other users through the Platform</li>
            </ul>
            <p className="mt-2"><strong className="text-white">Information collected automatically:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Device information (browser type, operating system, device identifiers)</li>
              <li>Usage data (pages visited, features used, time spent on the Platform)</li>
              <li>IP address and approximate location</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </Section>

          <Section title="4. How We Use Your Information">
            <p>We use your personal data for the following purposes:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><strong className="text-white">Service delivery:</strong> To provide, maintain, and improve the Calendrax platform</li>
              <li><strong className="text-white">Account management:</strong> To create and manage your account</li>
              <li><strong className="text-white">Bookings:</strong> To facilitate appointments between Business Owners and Customers</li>
              <li><strong className="text-white">Payments:</strong> To process subscriptions and deposit payments</li>
              <li><strong className="text-white">Communications:</strong> To send booking confirmations, reminders, and service updates</li>
              <li><strong className="text-white">Support:</strong> To respond to your enquiries and provide customer service</li>
              <li><strong className="text-white">Security:</strong> To protect against fraud and maintain platform security</li>
              <li><strong className="text-white">Legal compliance:</strong> To comply with applicable laws and regulations</li>
            </ul>
          </Section>

          <Section title="5. Legal Basis for Processing">
            <p>We process your personal data based on the following legal grounds:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><strong className="text-white">Contract:</strong> Processing necessary to perform our contract with you (providing our services)</li>
              <li><strong className="text-white">Legitimate interests:</strong> Processing necessary for our legitimate business interests (improving services, fraud prevention)</li>
              <li><strong className="text-white">Consent:</strong> Where you have given consent for specific processing activities (marketing communications)</li>
              <li><strong className="text-white">Legal obligation:</strong> Processing necessary to comply with legal requirements</li>
            </ul>
          </Section>

          <Section title="6. Data Sharing">
            <p>We may share your information with:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><strong className="text-white">Business Owners and Customers:</strong> To facilitate bookings and appointments</li>
              <li><strong className="text-white">Payment processors:</strong> Stripe processes payments on our behalf</li>
              <li><strong className="text-white">Service providers:</strong> Third parties who assist in operating our Platform (hosting, analytics, email services)</li>
              <li><strong className="text-white">Legal authorities:</strong> When required by law or to protect our rights</li>
            </ul>
            <p className="mt-2">We do not sell your personal data to third parties.</p>
          </Section>

          <Section title="7. Data Retention">
            <p>We retain your personal data for as long as necessary to:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Provide our services and maintain your account</li>
              <li>Comply with legal obligations (e.g., financial records for 6 years)</li>
              <li>Resolve disputes and enforce our agreements</li>
            </ul>
            <p className="mt-2">When you delete your account, we will delete or anonymise your personal data within 30 days, unless retention is required by law.</p>
          </Section>

          <Section title="8. Data Security">
            <p>We implement appropriate technical and organisational measures to protect your personal data, including:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Encryption of data in transit (HTTPS/TLS)</li>
              <li>Secure password hashing</li>
              <li>Regular security assessments</li>
              <li>Access controls and authentication</li>
            </ul>
            <p className="mt-2">However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security of your data.</p>
          </Section>

          <Section title="9. Your Rights">
            <p>Under UK GDPR, you have the following rights:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><strong className="text-white">Access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-white">Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong className="text-white">Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong className="text-white">Restriction:</strong> Request restriction of processing</li>
              <li><strong className="text-white">Portability:</strong> Request transfer of your data in a machine-readable format</li>
              <li><strong className="text-white">Objection:</strong> Object to processing based on legitimate interests</li>
              <li><strong className="text-white">Withdraw consent:</strong> Withdraw consent at any time where processing is based on consent</li>
            </ul>
            <p className="mt-2">To exercise these rights, please contact us at support@calendrax.com. We will respond within one month of receiving your request.</p>
          </Section>

          <Section title="10. Cookies">
            <p>We use cookies and similar technologies to:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Keep you logged in to your account</li>
              <li>Remember your preferences</li>
              <li>Analyse how you use our Platform</li>
              <li>Improve our services</li>
            </ul>
            <p className="mt-2">You can control cookies through your browser settings. Disabling certain cookies may affect the functionality of the Platform.</p>
          </Section>

          <Section title="11. International Transfers">
            <p>Your data may be transferred to and processed in countries outside the UK. When this occurs, we ensure appropriate safeguards are in place, such as:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Standard contractual clauses approved by the UK ICO</li>
              <li>Adequacy decisions by the UK government</li>
            </ul>
          </Section>

          <Section title="12. Children's Privacy">
            <p>Calendrax is not intended for children under 16 years of age. We do not knowingly collect personal data from children under 16. If we become aware that we have collected such data, we will take steps to delete it promptly.</p>
          </Section>

          <Section title="13. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on the Platform and updating the "Last updated" date. We encourage you to review this policy periodically.</p>
          </Section>

          <Section title="14. Complaints">
            <p>If you have concerns about how we handle your personal data, please contact us first at support@calendrax.com.</p>
            <p className="mt-2">You also have the right to lodge a complaint with the Information Commissioner's Office (ICO):</p>
            <p className="mt-2">
              <strong className="text-white">Information Commissioner's Office</strong><br />
              Website: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">ico.org.uk</a><br />
              Helpline: 0303 123 1113
            </p>
          </Section>

          <Section title="15. Contact Us">
            <p>For any questions about this Privacy Policy or our data practices, please contact:</p>
            <p className="mt-2">
              <strong className="text-white">Gareth Grey trading as Calendrax</strong><br />
              Email: support@calendrax.com
            </p>
          </Section>

        </div>

        <p className="text-gray-500 text-sm mt-6 text-center">
          Last updated: December 2025
        </p>
      </div>
    </div>
  );
};

export default Privacy;
