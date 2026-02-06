import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, XCircle, Calendar, Clock, Building2, Home } from 'lucide-react';
import { paymentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const BookingSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [status, setStatus] = useState('checking'); // checking, success, error
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);

  const sessionId = searchParams.get('session_id');
  const transactionId = searchParams.get('transaction_id');

  useEffect(() => {
    if (!sessionId && !transactionId) {
      setStatus('error');
      setError('Invalid booking session. Please try again.');
      return;
    }

    verifyPaymentAndCompleteBooking();
  }, [sessionId, transactionId]);

  const verifyPaymentAndCompleteBooking = async () => {
    const maxPolls = 5;
    const pollInterval = 2000;

    const poll = async (attempt) => {
      if (attempt >= maxPolls) {
        setStatus('error');
        setError('Payment verification timed out. Please check your email for confirmation or contact support.');
        return;
      }

      try {
        // Check payment status
        if (sessionId) {
          const statusRes = await paymentAPI.getStatus(sessionId);
          
          if (statusRes.data.paymentStatus === 'paid' || statusRes.data.status === 'completed') {
            // Payment confirmed - complete the booking
            const bookingRes = await paymentAPI.completeBooking({
              sessionId: sessionId,
              transactionId: transactionId
            });

            if (bookingRes.data.success) {
              setAppointment(bookingRes.data.appointment);
              setStatus('success');
              return;
            }
          } else if (statusRes.data.status === 'expired') {
            setStatus('error');
            setError('Payment session expired. Please try booking again.');
            return;
          }
        }

        // Continue polling
        setPollCount(attempt + 1);
        setTimeout(() => poll(attempt + 1), pollInterval);
      } catch (err) {
        console.error('Error verifying payment:', err);
        // Try to complete booking anyway in case payment was successful
        try {
          const bookingRes = await paymentAPI.completeBooking({
            sessionId: sessionId,
            transactionId: transactionId
          });

          if (bookingRes.data.success) {
            setAppointment(bookingRes.data.appointment);
            setStatus('success');
            return;
          }
        } catch (bookingErr) {
          setStatus('error');
          setError('Failed to verify payment. Please contact support if you were charged.');
        }
      }
    };

    poll(0);
  };

  return (
    <div className="min-h-screen bg-appbg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Checking Payment Status */}
        {status === 'checking' && (
          <div className="bg-card border border-zinc-800 rounded-2xl p-8 text-center">
            <Loader2 className="w-16 h-16 text-brand-500 mx-auto mb-4 animate-spin" />
            <h1 className="text-white text-2xl font-bold mb-2">Confirming Your Booking</h1>
            <p className="text-gray-400 mb-4">Please wait while we verify your payment...</p>
            <div className="flex justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${i < pollCount ? 'bg-brand-500' : 'bg-zinc-700'}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="bg-card border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-20 h-20 bg-brand-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-black" />
            </div>
            <h1 className="text-white text-2xl font-bold mb-2">Booking Confirmed!</h1>
            <p className="text-gray-400 mb-6">Your appointment has been successfully booked.</p>
            
            {appointment && (
              <div className="bg-zinc-800 rounded-xl p-4 mb-6 text-left">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-white">
                    <Building2 className="w-5 h-5 text-brand-400" />
                    <span>{appointment.businessName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white">
                    <span className="text-gray-400 text-sm ml-8">{appointment.serviceName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white">
                    <Calendar className="w-5 h-5 text-brand-400" />
                    <span>{appointment.date}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white">
                    <Clock className="w-5 h-5 text-brand-400" />
                    <span>{appointment.time}</span>
                  </div>
                  {appointment.staffName && (
                    <div className="flex items-center gap-3 text-gray-400 text-sm">
                      <span className="ml-8">with {appointment.staffName}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-zinc-700 mt-4 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Deposit Paid</span>
                    <span className="text-brand-400">
                      {appointment.depositPaid ? `£${appointment.depositAmount?.toFixed(2)}` : 'Free (Code Applied)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-400">Balance Due</span>
                    <span className="text-white">
                      £{(appointment.paymentAmount - (appointment.depositAmount || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <p className="text-gray-500 text-sm mb-6">
              The business will review your booking and confirm it shortly. 
              You'll receive a notification when it's approved.
            </p>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-brand-500 text-black font-semibold py-3 rounded-lg hover:bg-brand-400 transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="bg-card border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-white text-2xl font-bold mb-2">Booking Issue</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-brand-500 text-black font-semibold py-3 rounded-lg hover:bg-brand-400 transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => window.history.back()}
                className="w-full bg-zinc-800 text-white font-semibold py-3 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingSuccess;
