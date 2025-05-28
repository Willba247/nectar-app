export interface TicketEmailProps {
  userName: string;
  venueName: string;
  date: string;
  time: string;
}

export const generateTicketEmailTemplate = ({
  userName,
  venueName,
  date,
  time,
}: TicketEmailProps): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Queue Skip Ticket</title>
      <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          body, html {
              margin: 0;
              padding: 0;
              font-family: 'Inter', sans-serif;
              background-color: #f5f5f5;
          }
          
          .ticket-container {
              width: 90%;
              max-width: 500px;
              margin: 20px auto;
              background: linear-gradient(145deg, #1e2642, #0c1123);
              border-radius: 24px;
              overflow: hidden;
              color: #ffffff;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          }
          
          .ticket-header {
              padding: 40px 30px;
              text-align: center;
              position: relative;
              border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
              background: linear-gradient(145deg, #243053, #1a2642);
          }
          
          .logo {
              height: 40px;
              width: auto;
              object-fit: contain;
              margin-bottom: 30px;
          }
          
          .ticket-title {
              font-size: 32px;
              font-weight: 700;
              margin: 0 0 25px 0;
              color: #ffffff;
              letter-spacing: 1px;
          }
          
          .status-badge {
              background-color: #e94560;
              color: #ffffff;
              padding: 10px 20px;
              border-radius: 50px;
              font-size: 16px;
              font-weight: 600;
              display: inline-block;
              letter-spacing: 0.5px;
              box-shadow: 0 4px 15px rgba(233, 69, 96, 0.3);
          }
          
          .ticket-body {
              padding: 40px 30px;
          }
          
          .info-section {
              margin-bottom: 30px;
          }
          
          .info-label {
              font-size: 14px;
              text-transform: uppercase;
              color: rgba(255, 255, 255, 0.5);
              margin-bottom: 8px;
              letter-spacing: 1px;
          }
          
          .info-value {
              font-size: 24px;
              font-weight: 600;
              color: #ffffff;
              line-height: 1.4;
          }
          
          .ticket-footer {
              padding: 30px;
              text-align: center;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          .footer-text {
              font-size: 18px;
              color: #ffffff;
              margin: 0;
          }
          
          .venue-title {
              text-align: center;
              margin-bottom: 40px;
          }
          
          .venue-title .info-label {
              text-align: center;
          }
          
          .venue-title .info-value {
              font-size: 32px;
              font-weight: 700;
              letter-spacing: 0.5px;
          }
          
          @media screen and (max-width: 480px) {
              .ticket-container {
                  width: 95%;
                  margin: 10px auto;
              }
              
              .ticket-header {
                  padding: 30px 20px;
              }
              
              .ticket-body {
                  padding: 30px 20px;
              }
              
              .ticket-title {
                  font-size: 28px;
              }
              
              .info-value {
                  font-size: 20px;
              }
          }
      </style>
  </head>
  <body>
      <div class="ticket-container">
          <div class="ticket-header">
              <img src="https://thenectarapp.com/nectar-logo.png" alt="Nectar Logo" class="logo">
              <h1 class="ticket-title">QUEUE SKIP TICKET</h1>
              <div class="status-badge">PRIORITY ACCESS</div>
          </div>
          
          <div class="ticket-body">
              <div class="venue-title">
                  <div class="info-label">VENUE</div>
                  <div class="info-value">${venueName}</div>
              </div>

              <div class="info-section">
                  <div class="info-label">VISITOR</div>
                  <div class="info-value">${userName}</div>
              </div>
              
              <div class="info-section">
                  <div class="info-label">TIME</div>
                  <div class="info-value">${time}</div>
              </div>
              
              <div class="info-section">
                  <div class="info-label">DATE</div>
                  <div class="info-value">${date}</div>
              </div>
          </div>
          
          <div class="ticket-footer">
              <p class="footer-text">Present this ticket to the security guard with your ID</p>
          </div>
      </div>
  </body>
  </html>`;
};
