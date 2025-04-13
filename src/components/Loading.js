// components/Loading.js
import React from 'react';

function Loading() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center',
      alignItems: 'center',
      height: '200px',
      width: '100%'
    }}>
      <div style={{
        textAlign: 'center'
      }}>
        <div style={{
          border: '4px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '50%',
          borderTop: '4px solid #ffffff',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }}></div>
        <p>Loading weather data...</p>
      </div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Loading;