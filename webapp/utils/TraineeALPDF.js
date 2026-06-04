sap.ui.define(["../model/formatter"], function (Formatter) {
    "use strict";
    return {
         Formatter: Formatter,
        _GeneratePDF: function (that, oModel, oCompanyModel, content) {
            setTimeout(function () {
                var { jsPDF } = window.jspdf;
                var doc = new jsPDF({
                    unit: "mm",
                    format: "a4",
                    margins: { left: 30, right: 30 },
                    lineHeight: 1.5,
                    orientation: "portrait",
                });

                var pageWidth = doc.internal.pageSize.getWidth();
                var pageHeight = doc.internal.pageSize.getHeight();
                var margin = 25; // left and right margin
                var paraMargin = 6; // left margin for paragraphs
                var topMargin = 30;
                var footerHeight = 25; // reserve 25 units at the bottom for footer
                var maxWidth = pageWidth - 2 * margin; // usable width
                var pageMiddle = pageWidth / 2;
                let currentYPosition = 10; // Initial Y Position
                const backImgX = (pageWidth - 100) / 2; // Center horizontally
                const backImgY = (pageHeight - 100) / 2; // Center vertically
                const bottomLimit = pageHeight - footerHeight;
                let currentY;

                doc.setFont("times").setFontSize(12);

                function checkPageBreak(currentYPosition) {

                    if (currentYPosition >= bottomLimit) {
                        doc.addPage(); // Add a new page if the current position exceeds the limit
                        doc.addImage(oCompanyModel.emailLogoBase64, "PNG", 145, 8, 45, 10);
                        doc.setGState(new doc.GState({ opacity: 0.1 }));
                        doc.addImage(oCompanyModel.backgroundLogoBase64, "PNG", backImgX, backImgY, 100, 100);
                        doc.setGState(new doc.GState({ opacity: 1 }));
                        currentYPosition = topMargin; // Reset to top margin on the new page
                    }
                    return currentYPosition; // Return updated Y position
                }

                doc.addImage(oCompanyModel.companylogo64, "PNG", margin, currentYPosition, 45, 45);
                doc.setGState(new doc.GState({ opacity: 0.1 }));
                doc.addImage(oCompanyModel.backgroundLogoBase64, "PNG", backImgX, backImgY, 100, 100);
                doc.setGState(new doc.GState({ opacity: 1 }));
                doc.setFontSize(12);

                let addressLines = doc.splitTextToSize(oCompanyModel.longAddress, 75);
                let addressY = currentYPosition + 15;
                addressLines.forEach((line) => {
                    let textWidth = doc.getTextWidth(line); // Measure text width
                    let xPosition = pageWidth - textWidth - margin; // Align to right

                    doc.text(line, xPosition, addressY);
                    addressY += 6.5;
                });

                let mobileNo = oCompanyModel.mobileNo;
                let mobileWidth = doc.getTextWidth(mobileNo);
                let mobileX = pageWidth - mobileWidth - margin;
                doc.text(mobileNo, mobileX, addressY);

                let emailY = addressY + 6.5;
                let carrerEmail = oCompanyModel.carrerEmail;
                let carrerEmailWidth = doc.getTextWidth(carrerEmail);
                let emailX = pageWidth - carrerEmailWidth - margin;
                doc.text(carrerEmail, emailX, emailY);

                let dateY = 65;
                doc.text(oModel.CreateDate, margin, dateY);

                let currentAfterDateY = dateY;
                if (oModel.Self === "Trainee Offer") {
                    doc.setFont("times", "bold");
                    let empNameY = currentAfterDateY + 10;
                    doc.text(oModel.EmpName, margin, empNameY);

                    doc.setFont("times", "normal");
                    let empRoleY = empNameY + 6.5;
                    doc.text(oModel.EmpRole, margin, empRoleY);

                    let empAddressLines = doc.splitTextToSize(
                        oModel.EmpAddress,
                        65
                    );
                    let empAddressY = empRoleY + 6.5;
                    empAddressLines.forEach((line) => {
                        doc.text(line, margin, empAddressY);
                        empAddressY += 6;
                    });
                    currentAfterDateY = empAddressY - 6;
                }

                let titleY = currentAfterDateY + 11;
                let titleText = content[0].Title;
                doc.setFont("times", "bold").setFontSize(14);
                let textWidth = doc.getTextWidth(titleText);
                let titleX = (pageWidth - textWidth) / 2;
                doc.text(titleText, titleX, titleY);
                doc.setFont("times", "normal").setFontSize(12.5);

                let titleContentY = titleY + 10; // Initial Y position after titleY
                const agreementStartIndex = 18;

                for (let i = 0; i < agreementStartIndex; i++) {
                    if (oModel.StipendSkipLine && i === oModel.StipendSkipLine - 1) continue;
                    if (oModel.TrainingFeesSkipLine && i === oModel.TrainingFeesSkipLine - 1) continue;
                    if (!content[i]?.TitleContent) continue;

                    let titleContent = new Function("oCompanyModel", "oModel", `return ${content[i].TitleContent};`)(oCompanyModel, oModel);

                    let titleContentLines = doc.splitTextToSize(titleContent, maxWidth);

                    titleContentLines.forEach((line, lineIndex) => {
                        let words = line.split(" ");
                        let totalWords = words.length;
                        let lineWidth = doc.getTextWidth(line);
                        let spaceWidth = doc.getTextWidth(" ");
                        let currentX = margin;

                        if (lineIndex < titleContentLines.length - 1) {
                            let extraSpace = totalWords > 1 ? (maxWidth - lineWidth) / (totalWords - 1) : 0;

                            words.forEach((word, index) => {
                                if (word === "WHEREAS" || word.includes("Kalpavriksha Technologies")) {
                                    doc.setFont("times", "bold");
                                } else {
                                    doc.setFont("times", "normal");
                                }

                                doc.text(word, currentX, titleContentY);
                                currentX += doc.getTextWidth(word) + spaceWidth + (index < totalWords - 1 ? extraSpace : 0);
                            });

                        } else {
                            doc.text(line, margin, titleContentY);
                        }

                        titleContentY += 6.2;
                    });

                    titleContentY += 5.5;
                }

                let contentafterTitleContentY = titleContentY;
                if (oModel.Self === "Trainee Offer") {
                    doc.setFont("times", "bold");
                    let title3Y = contentafterTitleContentY + 2;
                    let title3 = new Function("oModel", `return ${content[2].Title};`)(oModel);
                    doc.text(title3, margin, title3Y);

                    let title4Y = title3Y + 11;

                    if (oModel.Type && Number(oModel.Amount || 0) > 0) {

                        doc.setFont("times", "bold");

                        doc.text("Type", margin, title4Y);
                        doc.text("Amount", margin + 50, title4Y);

                        title4Y += 8;

                        doc.setFont("times", "normal");

                        doc.text(
                            oModel.Type,   // Paid or Stipend
                            margin,
                            title4Y
                        );

                        doc.text(
                            (oModel.Currency || "INR") +
                            " " +
                             Formatter.fromatNumber(oModel.Amount || 0),
                            margin + 50,
                            title4Y
                        );

                        title4Y += 8;
                    }

                    currentY = title4Y + 11; // Start initial Y position
                    doc.setFont("times", "bold");

                    const maxPoints = 25; // Loop limit to handle up to 25 points

                    for (let i = 1; i <= maxPoints && (i - 1) < agreementStartIndex; i++) {
                        if (!content[i - 1]?.PointNo || !content[i - 1]?.PointTitle) break; // Break if data is missing to avoid errors
                        currentY += 3; // Add extra spacing between points
                        currentY = checkPageBreak(currentY);
                        // Add Point Number and Point Title
                        doc.setTextColor(0, 111, 191);
                        doc.text(`${content[i - 1].PointNo}.`, margin + (paraMargin - 6), currentY);
                        doc.text(content[i - 1].PointTitle, margin + paraMargin, currentY);
                        doc.setTextColor(0, 0, 0);

                        doc.setFont("times", "normal");
                        currentY += 11; // Increment Y position for the content section

                        let pointContentY = currentY;
                        let pointContentTemplate = new Function("oCompanyModel", "oModel", `return ${content[i - 1].PointDesc};`)(oCompanyModel, oModel);

                        let pointContentParas = pointContentTemplate.split(`\n\n`); // Split content by paragraphs

                        // Loop through each paragraph in the PointDesc
                        pointContentParas.forEach((paragraph) => {
                            let pointContentLines = doc.splitTextToSize(paragraph, maxWidth - paraMargin); // Break paragraph into lines

                            pointContentLines.forEach((line, lineIndex) => {
                                let words = line.split(" ");
                                let totalWords = words.length;

                                // Calculate line width and space width
                                let lineWidth = doc.getTextWidth(line);
                                let spaceWidth = doc.getTextWidth(" ");

                                // Apply the page-break check
                                pointContentY = checkPageBreak(pointContentY);

                                if (lineIndex < pointContentLines.length - 1) {
                                    // Justify all lines except the last line of each paragraph
                                    let extraSpace = totalWords > 1 ? ((maxWidth - paraMargin) - lineWidth) / (totalWords - 1) : 0;
                                    let currentX = margin + paraMargin;

                                    words.forEach((word, index) => {
                                        doc.text(word, currentX, pointContentY);
                                        currentX += doc.getTextWidth(word) + spaceWidth + (index < totalWords - 1 ? extraSpace : 0);
                                    });
                                } else {
                                    // Last line of the paragraph left-aligned
                                    doc.text(line, margin + paraMargin, pointContentY);
                                }

                                pointContentY += 6.2; // Increment Y position after each line
                            });

                            pointContentY += 3; // Add extra spacing between paragraphs
                        });

                        currentY = pointContentY; // Update Y position for the next PointTitle
                        doc.setFont("times", "bold");
                    }
                    contentafterTitleContentY = currentY;
                }

                if (oModel.Self === "Trainee Offer") {
                    if (contentafterTitleContentY > bottomLimit - 90) {
                        doc.addPage();
                        doc.addImage(oCompanyModel.emailLogoBase64, "PNG", 145, 8, 45, 10);
                        doc.setGState(new doc.GState({ opacity: 0.1 }));
                        doc.addImage(oCompanyModel.backgroundLogoBase64, "PNG", backImgX, backImgY, 100, 100);
                        doc.setGState(new doc.GState({ opacity: 1 }));
                        contentafterTitleContentY = topMargin;
                    }
                }

                doc.setFont("times", "bold").setFontSize(12);
                let forCoNameY = contentafterTitleContentY + 10;
                doc.text(`For ${oCompanyModel.companyName}.`, margin, forCoNameY);

                let coSignY = forCoNameY + 5;
                doc.addImage(oCompanyModel.signature64, "PNG", margin, coSignY, 57, 13);

                let headofCoNameY = coSignY + 20;
                doc.text(oCompanyModel.headOfCompany, margin, headofCoNameY);

                doc.setFont("times", "normal");
                let headofCoRoleY = headofCoNameY + 5;
                doc.text(oCompanyModel.designation, margin, headofCoRoleY);

                let acceptTCVisY = headofCoRoleY + 15;
                if (oModel.Self === "Trainee Offer") {
                    let acceptTCY = acceptTCVisY;
                    doc.text("I have read and accept the terms and conditions:", margin, acceptTCY);
                    acceptTCVisY = acceptTCY + 15;
                }

                let cNameY = acceptTCVisY;
                doc.text("Candidate Name: .................................................", margin, cNameY);

                let cJoinDate = cNameY + 11;
                doc.text("Date of Joining: ...................................................", margin, cJoinDate);

                let cSignY = cJoinDate + 11;
                doc.text("Signature: ............................................................", margin, cSignY);


                if (oModel.Self === "Trainee Offer") {

                    //                    doc.setFont("helvetica", "bold");
                    // doc.setFontSize(12);

                    // let stipendY = currentY + 10;

                    // stipendY = checkPageBreak(stipendY);

                    // doc.text("Stipend Details", margin, stipendY);

                    // stipendY += 10;

                    // doc.setFont("helvetica", "normal");

                    // doc.text("Self", margin, stipendY);
                    // doc.text("Amount", margin + 60, stipendY);

                    // stipendY += 5;

                    // doc.line(
                    //     margin,
                    //     stipendY,
                    //     margin + 100,
                    //     stipendY
                    // );

                    // stipendY += 8;

                    // doc.text("Paid Stipend", margin, stipendY);

                    // doc.text(
                    //     `${oModel.Currency || "INR"} ${oModel.Stipend || 0}`,
                    //     margin + 60,
                    //     stipendY
                    // );

                    // currentY = stipendY + 15;

                    // ================= NEW PAGE FOR AGREEMENT =================
                    doc.addPage();

                    // Header logos
                    doc.addImage(oCompanyModel.companylogo64, "PNG", margin, 10, 45, 45);
                    doc.setGState(new doc.GState({ opacity: 0.1 }));
                    doc.addImage(oCompanyModel.backgroundLogoBase64, "PNG", backImgX, backImgY, 100, 100);
                    doc.setGState(new doc.GState({ opacity: 1 }));

                    let y = 55;

                    // ================= RIGHT SIDE COMPANY DETAILS =================
                    let rightY = 20;
                    let lineGap = 6.5;

                    // Address
                    let addressLines = doc.splitTextToSize(oCompanyModel.longAddress, 75);
                    addressLines.forEach((line) => {
                        doc.text(line, pageWidth - margin, rightY, { align: "right" });
                        rightY += lineGap;
                    });

                    // Mobile
                    rightY += 1;
                    doc.text(oCompanyModel.mobileNo, pageWidth - margin, rightY, { align: "right" });

                    // Email
                    rightY += lineGap;
                    doc.text(oCompanyModel.carrerEmail, pageWidth - margin, rightY, { align: "right" });

                    // ================= SPACE BEFORE TITLE =================
                    y = Math.max(y, rightY + 12);

                    // ================= HELPER FUNCTION =================
                    function evaluateText(template, oCompanyModel, oModel) {
                        if (!template) return "";

                        // If template contains ${} → evaluate
                        if (template.includes("${")) {
                            try {
                                return new Function(
                                    "oCompanyModel",
                                    "oModel",
                                    `return ${template};`
                                )(oCompanyModel, oModel);
                            } catch (e) {
                                console.error("Template error:", template);
                                return template;
                            }
                        }

                        // Otherwise return as plain text
                        return template;
                    }

                    // ================= HEADER DATA (POINT 19) =================
                    let headerIndex = 18;
                    let headerData = content[headerIndex] || {};

                    // ================= TITLE =================
                    if (headerData.Title) {
                        y += 5;

                        doc.setFont("times", "bold").setFontSize(11);

                        let title = evaluateText(headerData.Title, oCompanyModel, oModel);

                        let titleWidth = doc.getTextWidth(title);
                        doc.text(title, (pageWidth - titleWidth) / 2, y);

                        y += 10;
                    }

                    // ================= INTRO =================
                    doc.setFont("times", "normal").setFontSize(10);

                    if (headerData.TitleContent) {
                        let intro = evaluateText(headerData.TitleContent, oCompanyModel, oModel);

                        let introLines = doc.splitTextToSize(intro, maxWidth);

                        introLines.forEach(line => {
                            doc.text(line, margin, y);
                            y += 5;
                        });
                    }

                    // ================= EMPLOYEE LINE (DYNAMIC) =================
                    if (headerData.EmployeeLine) {

                        let empLine = evaluateText(headerData.EmployeeLine, oCompanyModel, oModel);

                        let empLines = doc.splitTextToSize(empLine, maxWidth);

                        empLines.forEach(line => {
                            doc.text(line, margin, y);
                            y += 5;
                        });

                    }

                    y += 3;

                    // ================= PAGE BREAK FUNCTION =================
                    function checkPageBreak(yPos) {
                        if (yPos > pageHeight - 30) {
                            doc.addPage();

                            doc.addImage(oCompanyModel.emailLogoBase64, "PNG", 145, 8, 45, 10);
                            doc.setGState(new doc.GState({ opacity: 0.1 }));
                            doc.addImage(oCompanyModel.backgroundLogoBase64, "PNG", backImgX, backImgY, 100, 100);
                            doc.setGState(new doc.GState({ opacity: 1 }));

                            return topMargin;
                        }
                        return yPos;
                    }

                    // ================= DYNAMIC SECTIONS =================
                    for (let i = headerIndex; i < content.length; i++) {

                        if (!content[i]?.PointTitle) continue;

                        y = checkPageBreak(y);

                        // Title
                        doc.setFont("times", "bold");
                        doc.text(content[i].PointTitle, margin, y);

                        y += 6;
                        doc.setFont("times", "normal");

                        // Description
                        let sectionText = evaluateText(content[i].PointDesc, oCompanyModel, oModel);

                        let paragraphs = sectionText.split("\n\n");

                        paragraphs.forEach((para) => {

                            let lines = doc.splitTextToSize(para, maxWidth - 5);

                            lines.forEach((line) => {
                                y = checkPageBreak(y);
                                doc.text(line, margin + 4, y);
                                y += 5;
                            });

                            y += 2;
                        });

                        y += 4;
                    }

                    // ================= SIGNATURE SECTION =================
                    let requiredHeight = 45;

                    // Check before rendering
                    if (y + requiredHeight > pageHeight - 30) {
                        doc.addPage();

                        doc.addImage(oCompanyModel.emailLogoBase64, "PNG", 145, 8, 45, 10);
                        doc.setGState(new doc.GState({ opacity: 0.1 }));
                        doc.addImage(oCompanyModel.backgroundLogoBase64, "PNG", backImgX, backImgY, 100, 100);
                        doc.setGState(new doc.GState({ opacity: 1 }));

                        y = topMargin;
                    }

                    y += 10;

                    let leftX = margin;
                    let rightX = pageMiddle + 10;

                    // LEFT SIDE
                    let leftY = y;
                    doc.text(oCompanyModel.companyName, leftX, leftY);

                    leftY += 8;
                    doc.text(oCompanyModel.headOfCompany, leftX, leftY);

                    leftY += 8;
                    doc.text("Date: ____________________", leftX, leftY);

                    leftY += 8;
                    doc.text("Signature: ____________________", leftX, leftY);

                    // RIGHT SIDE
                    let rightY2 = y;
                    doc.text(`Trainee ID: ${oModel.EmpID}`, rightX, rightY2);

                    rightY2 += 8;
                    doc.text(`Trainee Name: ${oModel.EmpName}`, rightX, rightY2);

                    rightY2 += 8;
                    doc.text("Date: ____________________", rightX, rightY2);

                    rightY2 += 8;
                    doc.text("Signature: ____________________", rightX, rightY2);

                }
                doc.save(`${oModel.EmpName} ${oModel.Self} Letter.pdf`);
                that.closeBusyDialog();
            }, 1000);
        }
    };
});