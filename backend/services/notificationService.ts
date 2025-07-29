// backend/src/services/notificationService.ts

import { sendEmail } from './emailServices'; // Your existing email service
import pool from '../db'; // Your database pool
import { format, parseISO } from 'date-fns';
// --- Interfaces for data types (you might have these defined elsewhere) ---
interface EmployeeInfo {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface PocInfo {
  id: number;
  title: string;
  customer_name: string;
  technology: string[];
  start_date: string | null;
  end_date: string | null;
  description: string | null; // NEW
  is_budget_allocated: boolean | null; // NEW
  is_vendor_aware: boolean | null; // NEW
}

interface Assignment {
  employeeId: number;
  role: string;
}

// --- Helper function to get basic employee details ---
async function getEmployeeInfoById(id: number): Promise<EmployeeInfo | null> {
  try {
    const result = await pool.query('SELECT id, first_name, last_name, email FROM employees WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error(`Error fetching employee info for ID ${id}:`, error);
    return null;
  }
}

// --- Helper function to get basic PoC details ---
async function getPocInfoById(id: number): Promise<PocInfo | null> {
  try {
    const result = await pool.query(
      `SELECT 
         p.id, p.title, p.technology, p.start_date, p.end_date, c.name as customer_name,
         p.description, p.is_budget_allocated, p.is_vendor_aware 
       FROM pocs p 
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error(`Error fetching PoC info for ID ${id}:`, error);
    return null;
  }
}

async function getProjectInfoById(id: number): Promise<PocInfo | null> {
    try {
        const result = await pool.query(
            `SELECT 
                p.id, p.title, p.technology, p.start_date, p.end_date, c.name as customer_name 
             FROM projects p 
             LEFT JOIN customers c ON p.customer_id = c.id
             WHERE p.id = $1`, [id]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error(`Error fetching PoC info for ID ${id}:`, error);
        return null;
    }
}

async function getEmployeesByRole(role: string): Promise<EmployeeInfo[]> {
  try {
    const result = await pool.query(
      "SELECT id, first_name, last_name, email FROM employees WHERE role = $1",
      [role]
    );
    return result.rows || [];
  } catch (error) {
    console.error(`Error fetching employees for role ${role}:`, error);
    return [];
  }
}

/**
 * Sends notifications when a PoC is first created and submitted for approval.
 */
// UPDATED: Emails now include budget and vendor awareness status
export async function sendPoCRequestNotifications(
  pocId: number,
  creatorId: number
) {
  try {
    const [poc, creator, presalesTeam] = await Promise.all([
      getPocInfoById(pocId),
      getEmployeeInfoById(creatorId),
      getEmployeesByRole("Presales"),
    ]);

    if (!poc || !creator) {
      console.error(
        "Could not send PoC request notifications: missing PoC or creator data.",
        { poc, creator }
      );
      return;
    }

    const pocLink = `${process.env.FRONTEND_URL}/pocs/${poc.id}`;
    const technologyList = Array.isArray(poc.technology) ? poc.technology.join(', ') : poc.technology;
    const budgetAllocated = poc.is_budget_allocated ? 'Yes' : 'No';
    const vendorAware = poc.is_vendor_aware ? 'Yes' : 'No';
    
    // Details table for emails
    const detailsTableHtml = `
      <h3 style="color: #2d3748;">Pre-Approval Details</h3>
      <table style="border-collapse: collapse; width: 100%; max-width: 500px; border: 1px solid #e2e8f0;">
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; background-color: #f7fafc; font-weight: bold; width: 150px;">Customer</td><td style="padding: 8px;">${poc.customer_name}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Technology</td><td style="padding: 8px;">${technologyList}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Budget Allocated</td><td style="padding: 8px;">${budgetAllocated}</td></tr>
          <tr><td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Vendor Aware</td><td style="padding: 8px;">${vendorAware}</td></tr>
        </tbody>
      </table>`;
    const detailsText = `\nPre-Approval Details:\n- Customer: ${poc.customer_name}\n- Technology: ${technologyList}\n- Budget Allocated: ${budgetAllocated}\n- Vendor Aware: ${vendorAware}\n`;


    // 1. Email to the Account Manager (creator) for confirmation
    if (creator.email) {
      sendEmail({
        to: creator.email,
        subject: `PoC Request Submitted: ${poc.title}`,
        text: `Hi ${creator.first_name},\n\nYou have successfully submitted the Proof of Concept "${poc.title}" for approval. It has been sent to the Presales team for review.${detailsText}\nYou can view your request here: ${pocLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hi ${creator.first_name},</p>
            <p>You have successfully submitted the Proof of Concept "<strong>${poc.title}</strong>" for approval. It has been sent to the Presales team for review.</p>
            ${detailsTableHtml}
            <p style="margin-top: 20px;">
              <a href="${pocLink}" style="background-color: #4a5568; color: #ffffff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">View PoC Request</a>
            </p>
          </div>`,
      });
    }

    // 2. Email to the Presales team for approval
    if (presalesTeam.length > 0) {
        for (const presalesMember of presalesTeam) {
            if (presalesMember.email) {
                sendEmail({
                    to: presalesMember.email,
                    subject: `Action Required: New PoC for Approval - ${poc.title}`,
                    text: `Hi ${presalesMember.first_name},\n\nA new Proof of Concept, "${poc.title}", created by ${creator.first_name} ${creator.last_name}, requires your approval.${detailsText}\nPlease review and approve it here: ${pocLink}`,
                    html: `
                      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                        <p>Hi ${presalesMember.first_name},</p>
                        <p>A new Proof of Concept, "<strong>${poc.title}</strong>", created by <strong>${creator.first_name} ${creator.last_name}</strong>, requires your approval.</p>
                        ${detailsTableHtml}
                        <p style="margin-top: 20px;">
                          <a href="${pocLink}" style="background-color: #3182ce; color: #ffffff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Review and Approve PoC</a>
                        </p>
                      </div>`,
                });
            }
        }
    }
  } catch (error) {
    console.error("Error processing PoC request notifications:", error);
  }
}


/**
 * Sends notifications after a PoC has been approved by Presales.
 */
// UPDATED: Emails now include the Presales Description
export async function sendPoCApprovalNotifications(
  pocId: number,
  approverId: number,
  accountManagerId: number,
  technicalLeadId: number
) {
  try {
    const [poc, approver, accountManager, technicalLead] = await Promise.all([
      getPocInfoById(pocId),
      getEmployeeInfoById(approverId),
      getEmployeeInfoById(accountManagerId),
      getEmployeeInfoById(technicalLeadId),
    ]);

    if (!poc || !approver || !accountManager || !technicalLead) {
      console.error(
        "Could not send PoC approval notifications: missing data.",
        { poc, approver, accountManager, technicalLead }
      );
      return;
    }

    const pocLink = `${process.env.FRONTEND_URL}/pocs/${poc.id}`;
    const pocDescription = poc.description || 'N/A';
    const formattedStartDate = poc.start_date ? format(new Date(poc.start_date), "MMM d, yyyy") : 'Not set';
    const formattedEndDate = poc.end_date ? format(new Date(poc.end_date), "MMM d, yyyy") : 'Not set';
    const technologyList = Array.isArray(poc.technology) ? poc.technology.join(', ') : poc.technology;

    // Block for Presales Description
    const descriptionHtml = `
        <h3 style="color: #2d3748; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 25px;">Presales Description</h3>
        <div style="padding: 15px; background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 5px; margin-top: 10px;">
            <p style="margin:0;">${pocDescription.replace(/\n/g, '<br>')}</p>
        </div>`;
    
    // Reusable block for the main PoC details table
    const detailsTableHtml = `
        <h3 style="color: #2d3748; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 25px;">PoC Details</h3>
        <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; background-color: #f7fafc; font-weight: bold; width: 150px;">Customer</td><td style="padding: 10px;">${poc.customer_name}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; background-color: #f7fafc; font-weight: bold;">Technology</td><td style="padding: 10px;">${technologyList}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; background-color: #f7fafc; font-weight: bold;">Start Date</td><td style="padding: 10px;">${formattedStartDate}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; background-color: #f7fafc; font-weight: bold;">Est. End Date</td><td style="padding: 10px;">${formattedEndDate}</td></tr>
            <tr><td style="padding: 10px; background-color: #f7fafc; font-weight: bold;">Assigned Tech Lead</td><td style="padding: 10px;">${technicalLead.first_name} ${technicalLead.last_name}</td></tr>
          </tbody>
        </table>`;

    // 1. Email to the Account Manager
    if (accountManager.email) {
      sendEmail({
        to: accountManager.email,
        subject: `Approved: Your PoC "${poc.title}" is now active!`,
        text: `Hi ${accountManager.first_name},\n\nGood news! Your Proof of Concept, "${poc.title}", has been approved by ${approver.first_name} ${approver.last_name} and is now active.\n\nPresales Description:\n${pocDescription}\n\nPoC Details:\n- Customer: ${poc.customer_name}\n- Technology: ${technologyList}\n- Start Date: ${formattedStartDate}\n- Est. End Date: ${formattedEndDate}\n- Assigned Tech Lead: ${technicalLead.first_name} ${technicalLead.last_name}\n\nYou can view the active PoC here: ${pocLink}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <p>Hi ${accountManager.first_name},</p>
              <p>Good news! Your Proof of Concept, "<strong>${poc.title}</strong>", has been approved by <strong>${approver.first_name} ${approver.last_name}</strong> and is now active.</p>
              ${descriptionHtml}
              ${detailsTableHtml}
              <p style="margin-top: 25px;">
                <a href="${pocLink}" style="background-color: #4a5568; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Active PoC</a>
              </p>
            </div>`,
      });
    }

    // 2. Email to the assigned Technical Lead
    if (technicalLead.email) {
      sendEmail({
        to: technicalLead.email,
        subject: `You have been assigned as Technical Lead for PoC: ${poc.title}`,
        text: `Hi ${technicalLead.first_name},\n\nYou have been assigned as the Technical Lead for the new Proof of Concept "${poc.title}", which has been approved by ${approver.first_name} ${approver.last_name} and is now active.\n\nPresales Description:\n${pocDescription}\n\nPoC Details:\n- Customer: ${poc.customer_name}\n- Technology: ${technologyList}\n- Start Date: ${formattedStartDate}\n- Est. End Date: ${formattedEndDate}\n\nPlease review the full details in the portal and begin the next steps: ${pocLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Hi ${technicalLead.first_name},</p>
            <p>You have been assigned as the Technical Lead for the new Proof of Concept "<strong>${poc.title}</strong>", which has been approved by <strong>${approver.first_name} ${approver.last_name}</strong> and is now active.</p>
            ${descriptionHtml}
            ${detailsTableHtml}
            <p style="margin-top: 25px;">Please review the full details in the portal and begin the next steps.</p>
            <p>
              <a href="${pocLink}" style="background-color: #4a5568; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View PoC Details</a>
            </p>
          </div>`,
      });
    }
  } catch (error) {
    console.error("Error processing PoC approval notifications:", error);
  }
}

// --- Notification for PoC Creation ---
export async function sendPoCCreationNotifications(pocId: number, accountManagerId: number, technicalLeadId: number) {
  try {
    const [poc, accountManager, technicalLead] = await Promise.all([
      getPocInfoById(pocId),
      getEmployeeInfoById(accountManagerId),
      getEmployeeInfoById(technicalLeadId)
    ]);

    if (!poc || !accountManager || !technicalLead) {
      console.error("Could not send PoC creation notifications: missing data.", { poc, accountManager, technicalLead });
      return;
    }

    const pocLink = `${process.env.FRONTEND_URL}/pocs/${poc.id}`;

    const formattedStartDate = poc.start_date ? format(poc.start_date, "MMM d, yyyy") : 'Not set';
    const formattedEndDate = poc.end_date ? format(poc.end_date, "MMM d, yyyy") : 'Not set';

    // 1. Email to the Account Manager (the creator)
    if (accountManager.email) {
      sendEmail({
        to: accountManager.email,
        subject: `Confirmation: You created PoC: ${poc.title}`,
        // Updated plain text version
        text: `Hi ${accountManager.first_name},\n\nThis is a confirmation that you have successfully created the Proof of Concept "${poc.title}".\n\nPoC Details:\n- Customer: ${poc.customer_name}\n- Technology: ${poc.technology}\n- Start Date: ${formattedStartDate}\n- Est. End Date: ${formattedEndDate}\n\nYou have assigned ${technicalLead.first_name} ${technicalLead.last_name} as the Technical Lead.\n\nYou can view the PoC here: ${pocLink}`,
        
        // Updated HTML version with a nice table
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hi ${accountManager.first_name},</p>
            <p>This is a confirmation that you have successfully created the Proof of Concept "<strong>${poc.title}</strong>".</p>
            <h3 style="color: #2d3748;">PoC Details</h3>
            <table style="border-collapse: collapse; width: 100%; max-width: 500px; border: 1px solid #e2e8f0;">
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; background-color: #f7fafc; font-weight: bold; width: 150px;">Customer</td>
                  <td style="padding: 8px;">${poc.customer_name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Technology</td>
                  <td style="padding: 8px;">${poc.technology}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Start Date</td>
                  <td style="padding: 8px;">${formattedStartDate}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Est. End Date</td>
                  <td style="padding: 8px;">${formattedEndDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Assigned Tech Lead</td>
                  <td style="padding: 8px;">${technicalLead.first_name} ${technicalLead.last_name}</td>
                </tr>
              </tbody>
            </table>
            <p style="margin-top: 20px;">
              <a href="${pocLink}" style="background-color: #4a5568; color: #ffffff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">View PoC Details</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 12px; color: #777;">Please do not reply. This is an automated notification from the Apex.</p>
          </div>
        `
      });
    }

    // 2. Email to the assigned Technical Lead
    if (technicalLead.email) {
      sendEmail({
        to: technicalLead.email,
        subject: `You have been assigned as Technical Lead for PoC: ${poc.title}`,
        // Updated plain text version
        text: `Hi ${technicalLead.first_name},\n\n${accountManager.first_name} ${accountManager.last_name} has assigned you as the Technical Lead for the new Proof of Concept "${poc.title}".\n\nPoC Details:\n- Customer: ${poc.customer_name}\n- Technology: ${poc.technology}\n- Start Date: ${formattedStartDate}\n- Est. End Date: ${formattedEndDate}\n\nPlease review the details and begin the next steps.\n\nYou can view the PoC here: ${pocLink}`,
        
        // Updated HTML version with a nice table
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hi ${technicalLead.first_name},</p>
            <p><strong>${accountManager.first_name} ${accountManager.last_name}</strong> has assigned you as the Technical Lead for the new Proof of Concept "<strong>${poc.title}</strong>".</p>
            <h3 style="color: #2d3748;">PoC Details</h3>
            <table style="border-collapse: collapse; width: 100%; max-width: 500px; border: 1px solid #e2e8f0;">
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; background-color: #f7fafc; font-weight: bold; width: 150px;">Customer</td>
                  <td style="padding: 8px;">${poc.customer_name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Technology</td>
                  <td style="padding: 8px;">${poc.technology}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Start Date</td>
                  <td style="padding: 8px;">${formattedStartDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Est. End Date</td>
                  <td style="padding: 8px;">${formattedEndDate}</td>
                </tr>
              </tbody>
            </table>
            <p style="margin-top: 20px;">Please review the details and begin the next steps.</p>
            <p>
              <a href="${pocLink}" style="background-color: #4a5568; color: #ffffff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">View PoC Details</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 12px; color: #777;">Please do not reply. This is an automated notification from the Apex.</p>
          </div>
        `
      });
    }

  } catch (error) {
    console.error("Error processing PoC creation notifications:", error);
    // Log error, but don't let it block the main API response
  }
}


// --- Notification for Team Assignments (Handles both adding and removing) ---
export async function handlePocTeamChangeNotifications(pocId: number, originalAssignments: Assignment[], newAssignments: Assignment[], assignerId: number) {
  try {
    const [poc, assigner] = await Promise.all([
      getPocInfoById(pocId),
      getEmployeeInfoById(assignerId)
    ]);


    if (!poc || !assigner) {
      console.error("Could not process team change notifications: missing data.");
      return;
    }

    const pocLink = `${process.env.FRONTEND_URL}/pocs/${poc.id}`;
    const assignerName = `${assigner.first_name} ${assigner.last_name}`;

    const formattedStartDate = poc.start_date ? format(poc.start_date, "MMM d, yyyy") : 'Not set';
    const formattedEndDate = poc.end_date ? format(poc.end_date, "MMM d, yyyy") : 'Not set';


    const originalIds = new Set(originalAssignments.map(a => a.employeeId));
    const newIds = new Set(newAssignments.map(a => a.employeeId));

    // Find newly added members
    const addedMembers = newAssignments.filter(a => !originalIds.has(a.employeeId));

    for (const member of addedMembers) {
      const memberDetails = await getEmployeeInfoById(member.employeeId);
      if (memberDetails && memberDetails.email) {
        sendEmail({
          to: memberDetails.email,
          subject: `You've been assigned to PoC: ${poc.title}`,
          // Updated plain text version
          text: `Hi ${memberDetails.first_name},\n\n${assignerName} has assigned you to the Proof of Concept "${poc.title}" for customer "${poc.customer_name}".\n\nYour role for this PoC is: ${member.role}.\n\nPoC Details:\n- Customer: ${poc.customer_name}\n- Technology: ${poc.technology}\n- Start Date: ${formattedStartDate}\n- Est. End Date: ${formattedEndDate}\n\nYou can view the PoC here: ${pocLink}`,
          
          // Updated HTML version
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <p>Hi ${memberDetails.first_name},</p>
              <p><strong>${assignerName}</strong> has assigned you to the Proof of Concept "<strong>${poc.title}</strong>".</p>
              <p>Your assigned role is: <strong>${member.role}</strong>.</p>
              <h3 style="color: #2d3748;">PoC Details</h3>
              <table style="border-collapse: collapse; width: 100%; max-width: 500px; border: 1px solid #e2e8f0;">
                <tbody>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; background-color: #f7fafc; font-weight: bold; width: 150px;">Customer</td>
                    <td style="padding: 8px;">${poc.customer_name}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Technology</td>
                    <td style="padding: 8px;">${poc.technology}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Start Date</td>
                    <td style="padding: 8px;">${formattedStartDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Est. End Date</td>
                    <td style="padding: 8px;">${formattedEndDate}</td>
                  </tr>
                </tbody>
              </table>
              <p style="margin-top: 20px;">
                <a href="${pocLink}" style="background-color: #4a5568; color: #ffffff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">View PoC Details</a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 12px; color: #777;">Please do not reply. This is an automated notification from the Apex.</p>
            </div>
          `
        });
      }
    }

    // Find removed members
    const removedMembers = originalAssignments.filter(a => !newIds.has(a.employeeId));

    
    for (const member of removedMembers) {
        const memberDetails = await getEmployeeInfoById(member.employeeId);
        if (memberDetails && memberDetails.email) {
            sendEmail({
                to: memberDetails.email,
                subject: `You have been unassigned from PoC: ${poc.title}`,
                text: `Hi ${memberDetails.first_name},\n\nThis is a notification that you have been unassigned from the Proof of Concept "${poc.title}".\n\nNo further action is needed.`,
                html: `<p>Hi ${memberDetails.first_name},</p><p>This is a notification that you have been unassigned from the Proof of Concept "<strong>${poc.title}</strong>".</p><p>No further action is needed.</p>`
            });
        }
    }

  } catch (error) {
    console.error("Error processing team change notifications:", error);
  }
}


export async function handleProTeamChangeNotifications(projectId: number, originalAssignments: Assignment[], newAssignments: Assignment[], assignerId: number) {
  try {
    const [project, assigner] = await Promise.all([
      getProjectInfoById(projectId),
      getEmployeeInfoById(assignerId)
    ]);


    if (!project || !assigner) {
      console.error("Could not process team change notifications: missing data.");
      return;
    }

    const projectLink = `${process.env.FRONTEND_URL}/project/${project.id}`;
    const assignerName = `${assigner.first_name} ${assigner.last_name}`;

    const formattedStartDate = project.start_date ? format(project.start_date, "MMM d, yyyy") : 'Not set';
    const formattedEndDate = project.end_date ? format(project.end_date, "MMM d, yyyy") : 'Not set';


    const originalIds = new Set(originalAssignments.map(a => a.employeeId));
    const newIds = new Set(newAssignments.map(a => a.employeeId));

    // Find newly added members
    const addedMembers = newAssignments.filter(a => !originalIds.has(a.employeeId));

    for (const member of addedMembers) {
      const memberDetails = await getEmployeeInfoById(member.employeeId);
      if (memberDetails && memberDetails.email) {
        sendEmail({
          to: memberDetails.email,
          subject: `You've been assigned to Project: ${project.title}`,
          // Updated plain text version
          text: `Hi ${memberDetails.first_name},\n\n${assignerName} has assigned you to the Project "${project.title}" for customer "${project.customer_name}".\n\nYour role for this Project is: ${member.role}.\n\nProject Details:\n- Customer: ${project.customer_name}\n- Technology: ${project.technology}\n- Start Date: ${formattedStartDate}\n- Est. End Date: ${formattedEndDate}\n\nYou can view the PoC here: ${projectLink}`,
          
          // Updated HTML version
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <p>Hi ${memberDetails.first_name},</p>
              <p><strong>${assignerName}</strong> has assigned you to the Proof of Concept "<strong>${project.title}</strong>".</p>
              <p>Your assigned role is: <strong>${member.role}</strong>.</p>
              <h3 style="color: #2d3748;">Project Details</h3>
              <table style="border-collapse: collapse; width: 100%; max-width: 500px; border: 1px solid #e2e8f0;">
                <tbody>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; background-color: #f7fafc; font-weight: bold; width: 150px;">Customer</td>
                    <td style="padding: 8px;">${project.customer_name}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Technology</td>
                    <td style="padding: 8px;">${project.technology}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Start Date</td>
                    <td style="padding: 8px;">${formattedStartDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; background-color: #f7fafc; font-weight: bold;">Est. End Date</td>
                    <td style="padding: 8px;">${formattedEndDate}</td>
                  </tr>
                </tbody>
              </table>
              <p style="margin-top: 20px;">
                <a href="${projectLink}" style="background-color: #4a5568; color: #ffffff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">View Project Details</a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 12px; color: #777;">Please do not reply. This is an automated notification from the Apex.</p>
            </div>
          `
        });
      }
    }

    // Find removed members
    const removedMembers = originalAssignments.filter(a => !newIds.has(a.employeeId));

    
    for (const member of removedMembers) {
        const memberDetails = await getEmployeeInfoById(member.employeeId);
        if (memberDetails && memberDetails.email) {
            sendEmail({
                to: memberDetails.email,
                subject: `You have been unassigned from Project: ${project.title}`,
                text: `Hi ${memberDetails.first_name},\n\nThis is a notification that you have been unassigned from the Project "${project.title}".\n\nNo further action is needed.`,
                html: `<p>Hi ${memberDetails.first_name},</p><p>This is a notification that you have been unassigned from the Project "<strong>${project.title}</strong>".</p><p>No further action is needed.</p>`
            });
        }
    }

  } catch (error) {
    console.error("Error processing team change notifications:", error);
  }
}
