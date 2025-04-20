// import React from 'react';
// import {
//   Html,
//   Head,
//   Body,
//   Container,
//   Section,
//   Row,
//   Column,
//   Text,
//   Img,
//   Hr,
//   Link
// } from '@react-email/components';

// // Nectar Queue Skip Ticket Email Component
// export const NectarTicketEmail = ({
//   userName = 'Michael Eva',
//   venueName = 'The Espy',
//   date = '2025-04-18',
//   time = '15:29:33'
// }) => {
//   // Split the name into separate lines for display
//   const [firstName, lastName] = userName.split(' ');

//   // Split venue name if it has multiple words
//   const venueNameParts = venueName.split(' ');

//   return (
//     <Html>
//       <Head>
//         <title>Your Queue Skip Ticket for {venueName}</title>
//         <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//         <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet" />
//       </Head>
//       <Body style={styles.body}>
//         <Container style={styles.container}>
//           {/* Email Preheader Text */}
//           <Text style={styles.preheader}>
//             Your priority access ticket for {venueName} is ready!
//           </Text>

//           {/* Ticket Container */}
//           <Section style={styles.ticketContainer}>
//             {/* Ticket Header */}
//             <Section style={styles.ticketHeader}>
//               {/* Logo */}
//               <Img
//                 src="https://thenectarapp.com/nectar-logo.png"
//                 width="150"
//                 height="48"
//                 alt="Nectar Logo"
//                 style={styles.logo}
//               />

//               {/* Title */}
//               <Text style={styles.ticketTitle}>QUEUE SKIP TICKET</Text>

//               {/* Status Badge */}
//               <Section style={styles.badgeContainer}>
//                 <Text style={styles.statusBadge}>PRIORITY ACCESS</Text>
//               </Section>
//             </Section>

//             {/* Dotted Divider */}
//             <Hr style={styles.dottedDivider} />

//             {/* Ticket Body */}
//             <Section style={styles.ticketBody}>
//               <Row>
//                 {/* Left Column - Visitor & Time */}
//                 <Column>
//                   <Text style={styles.infoLabel}>VISITOR</Text>
//                   <Text style={styles.infoValue}>{firstName}<br />{lastName}</Text>

//                   <Text style={styles.infoLabel}>TIME</Text>
//                   <Text style={styles.infoValue}>{time}</Text>
//                 </Column>

//                 {/* Right Column - Venue & Date */}
//                 <Column>
//                   <Text style={styles.infoLabel}>VENUE</Text>
//                   <Text style={styles.infoValue}>
//                     {venueNameParts.map((part, index) => (
//                       index === 0 ? part : <React.Fragment key={index}><br />{part}</React.Fragment>
//                     ))}
//                   </Text>

//                   <Text style={styles.infoLabel}>DATE</Text>
//                   <Text style={styles.infoValue}>{date}</Text>
//                 </Column>
//               </Row>

//               {/* Gradient Divider */}
//               <Hr style={styles.gradientDivider} />

//               {/* Instructions */}
//               <Text style={styles.instructionPrimary}>
//                 Present this ticket to the venue staff
//               </Text>

//               <Section style={styles.menuContainer}>
//                 <Text style={styles.menuDots}>•••</Text>
//               </Section>

//               <Text style={styles.instructionSecondary}>
//                 Skip the regular line and enjoy priority access
//               </Text>
//             </Section>
//           </Section>

//           {/* Email Footer */}
//           <Section style={styles.footer}>
//             <Text style={styles.footerText}>
//               © 2025 Nectar App. All rights reserved.
//             </Text>
//             <Text style={styles.footerLinks}>
//               <Link href="#" style={styles.link}>Privacy Policy</Link> •
//               <Link href="#" style={styles.link}> Terms of Service</Link> •
//               <Link href="#" style={styles.link}> Unsubscribe</Link>
//             </Text>
//           </Section>
//         </Container>
//       </Body>
//     </Html>
//   );
// };

// // Styles
// const styles = {
//   body: {
//     backgroundColor: '#f5f5f5',
//     fontFamily: 'Montserrat, Arial, sans-serif',
//     margin: 0,
//     padding: 0,
//   },
//   container: {
//     margin: '30px auto',
//     maxWidth: '600px',
//     width: '100%',
//   },
//   preheader: {
//     color: '#f5f5f5',
//     display: 'none',
//     fontSize: '1px',
//     lineHeight: '1px',
//     maxHeight: 0,
//     maxWidth: 0,
//     opacity: 0,
//     overflow: 'hidden',
//   },
//   ticketContainer: {
//     backgroundColor: '#1b213e',
//     border: '1px solid #0c1028',
//     borderRadius: '16px',
//     boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
//     color: '#ffffff',
//     margin: '0 auto',
//     maxWidth: '500px',
//     overflow: 'hidden',
//   },
//   ticketHeader: {
//     backgroundColor: '#1b213e',
//     padding: '40px 30px 30px',
//     textAlign: 'center',
//   },
//   logo: {
//     height: '48px',
//     margin: '0 auto 20px',
//     width: '150px',
//   },
//   ticketTitle: {
//     color: '#ffffff',
//     fontSize: '30px',
//     fontWeight: '700',
//     letterSpacing: '2px',
//     lineHeight: '1.2',
//     margin: '0 0 25px',
//     textAlign: 'center',
//     textTransform: 'uppercase',
//   },
//   badgeContainer: {
//     textAlign: 'center',
//   },
//   statusBadge: {
//     backgroundColor: '#e94560',
//     borderRadius: '50px',
//     color: '#ffffff',
//     display: 'inline-block',
//     fontSize: '14px',
//     fontWeight: '600',
//     letterSpacing: '1px',
//     margin: '0 auto',
//     padding: '8px 25px',
//     textAlign: 'center',
//     textTransform: 'uppercase',
//   },
//   dottedDivider: {
//     borderTop: '2px dashed rgba(255, 255, 255, 0.2)',
//     margin: '0',
//   },
//   ticketBody: {
//     backgroundColor: '#151a30',
//     padding: '30px',
//   },
//   infoLabel: {
//     color: '#8a8fa3',
//     fontSize: '12px',
//     fontWeight: '500',
//     letterSpacing: '1px',
//     lineHeight: '1',
//     margin: '0 0 8px',
//     textTransform: 'uppercase',
//   },
//   infoValue: {
//     color: '#ffffff',
//     fontSize: '20px',
//     fontWeight: '600',
//     lineHeight: '1.4',
//     margin: '0 0 25px',
//   },
//   gradientDivider: {
//     background: 'linear-gradient(90deg, #e94560, #533483)',
//     border: 'none',
//     height: '2px',
//     margin: '15px 0 25px',
//   },
//   instructionPrimary: {
//     color: '#ffffff',
//     fontSize: '18px',
//     fontWeight: '500',
//     lineHeight: '1.4',
//     margin: '0',
//     textAlign: 'center',
//   },
//   menuContainer: {
//     textAlign: 'center',
//     margin: '15px 0',
//   },
//   menuDots: {
//     color: '#8a8fa3',
//     fontSize: '24px',
//     letterSpacing: '2px',
//     lineHeight: '1',
//     margin: '0',
//     textAlign: 'center',
//   },
//   instructionSecondary: {
//     color: '#8a8fa3',
//     fontSize: '14px',
//     lineHeight: '1.4',
//     margin: '0',
//     textAlign: 'center',
//   },
//   footer: {
//     margin: '30px auto 0',
//     padding: '0 30px',
//     textAlign: 'center',
//   },
//   footerText: {
//     color: '#666666',
//     fontSize: '12px',
//     lineHeight: '1.5',
//     margin: '0 0 10px',
//   },
//   footerLinks: {
//     color: '#666666',
//     fontSize: '12px',
//     lineHeight: '1.5',
//     margin: '0',
//   },
//   link: {
//     color: '#e94560',
//     textDecoration: 'none',
//   },
// };

// export default NectarTicketEmail;
