sap.ui.define([
    "sap/ui/core/format/DateFormat"
], function (DateFormat) {
    "use strict";
    return {
        formatDate: function (sDate) {

            if (sDate) {
                var oDateFormat = DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
                return oDateFormat.format(new Date(sDate));
            }
            return sDate;
        },

        formatMonthYear: function (sDateStr) {
            if (!sDateStr) return "";

            var oDate = new Date(sDateStr); // Convert ISO string to Date object
            var oDateFormat = sap.ui.core.format.DateFormat.getInstance({ pattern: "MM-yyyy" });

            return oDateFormat.format(oDate);
        },

        formatCurrency: function (value, code) {
            if (value || value === 0) {
                var oCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance({
                    currencyCode: false // hides the currency code like "INR"
                });
                var formatted = oCurrencyFormat.format(value);
                return code ? formatted + " " + code : formatted;
            }
            return "";
        },

        CurrencyInINRText: function (sValue) {
            if (sValue || sValue === 0) {
                return "INR" + " " + parseFloat(sValue).toLocaleString('en-IN');
            }
            return "";
        },

        CurrencyInINR: function (sValue) {
            if (sValue || sValue === 0) {
                return parseFloat(sValue).toLocaleString('en-IN');
            }
            return "";
        },

        formatObjectStatus: function (sStatus) {
            switch (sStatus) {
                case "New":
                    return "Indication05";
                case "Renew":
                    return "Indication03";
                case "Active":
                    return "Success";
                case "Approved":
                    return "Success";
                case "Inactive":
                    return "Error";
                case "Rejected":
                    return "Error";
                case "Submitted":
                    return "Indication03";
                case "Company":
                    return "Indication13";
                case 'Employee':
                    return "Success";
                case 'Draft':
                    return "Indication17";
                case "Onboarded":
                    return "Success";
                case "Rejected":
                    return "Error";
                case "Offer Sent":
                    return "Indication06";
                case "Invoiced":
                    return "Success";
                case "Payment Received":
                    return "Success";
                case "Invoice Sent":
                    return "Indication03";
                case "Send back by account":
                    return "Indication06";
                case "PDF Generated":
                    return "Indication18";
                case "Send back by manager":
                    return "Information";
                case "Paid":
                    return "Success";
                case "Available":
                    return "Success"
                case "Returned":
                    return "Success"
                case "Trashed":
                    return "Error"
                case "Assigned":
                    return "Information"
                case "Transferred":
                    return "Warning"
                case "Saved":
                    return "Indication03";
                case "Cancelled":
                    return "Indication03";
                case "Open":
                    return "Success";
                default:
                    return "Indication01";

            }
        },

        visibilityFormatter: function (selfServiceBtn, role, type) {
            var isAllowedRole = (role === 'Admin' || role === 'HR Manager' || role === 'HR');
            var isSaveOrSubmit = (type === 'Save' || type === 'Submit');
            // Self Service: show only if type is 'Save'
            if (selfServiceBtn) {
                return type === 'Save';
            }
            return isAllowedRole && isSaveOrSubmit;
        },
        resignationEndDateVisible: function (resignationEndDate, role) {
            var isAllowedRole = (role === 'Admin' || role === 'HR Manager' || role === 'HR');
            return !!resignationEndDate && isAllowedRole;
        },

        formatGrade: function (value) {
            if (!value) {
                return "";
            }
            if (value.includes("Percentage")) {
                var data = value.split(" ")
                return data[0] + " " + "%";
            }
            return value;
        },

        companyInvoicePayByDate: function (payByDate, status) {
            if (!payByDate || status !== "Invoice Sent") {
                return "None";
            }

            var dueDate = new Date(payByDate);
            var today = new Date();

            // Normalize time to 00:00:00 to avoid partial-day issues
            dueDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            var timeDiff = dueDate.getTime() - today.getTime();
            var daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            if (daysDiff < 0) {
                return "Error"; // Overdue
            } else if (daysDiff <= 10) {
                return "Information"; // Due soon
            } else {
                return "None"; // Not urgent
            }
        },


        // formatter.js
        formatContractEndState: function (endDate) {
            if (!endDate) return "None";

            const contractEnd = new Date(endDate);
            const today = new Date();

            contractEnd.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            const diffDays = Math.ceil((contractEnd - today) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) return "Error";
            if (diffDays <= 10) return "Warning";
            return "None";
        }
        ,

        formatMaxDate: function () {
            var oDate = new Date()
            if (oDate) {
                return new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
            }
            return null;
        },

        formatMinDate: function () {
            var oDate = new Date()
            if (oDate) {
                return new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());
            }
            return null;
        },

        formatCompanyAndDescription: function (description, startDate, EndDate) {
            if (description) {
                return description + " " + "(" + startDate + " - " + EndDate + ")";
            } else if (description) {
                return description;
            } else {
                return "";
            }
        },

        fromatNumber: function (currencyOrValue, totalAmount, amountInINR) {
            var avalue;

            // If only one argument passed, treat it as value to format
            if (totalAmount === undefined && amountInINR === undefined) {
                avalue = currencyOrValue;
            } else {
                // Multiparameter call from multi-part binding
                avalue = currencyOrValue === "INR" ? totalAmount : amountInINR;
            }

            if (avalue === "0" || avalue === 0) {
                return "- -";
            }
            var numericValue = parseFloat(avalue);
            if (isNaN(numericValue)) {
                return "";
            }

            var oFormatOptions = {
                groupingBaseSize: 3,
                groupingSize: 2,
                minIntegerDigits: 1,
                minFractionDigits: 2,
                maxFractionDigits: 2
            };

            var oFloatFormat = sap.ui.core.format.NumberFormat.getFloatInstance(oFormatOptions);
            return oFloatFormat.format(numericValue);
        },

        formatAmount: function (currencyOrValue, totalAmount, amountInINR) {
            var avalue;

            // If only one argument passed, treat it as value to format
            if (totalAmount === undefined && amountInINR === undefined) {
                avalue = currencyOrValue;
            } else {
                // Multiparameter call from multi-part binding
                avalue = currencyOrValue === "INR" ? totalAmount : amountInINR;
            }

            if (avalue === "0" || avalue === 0) {
                return "0.00";
            }
            var numericValue = parseFloat(avalue);
            if (isNaN(numericValue)) {
                return "";
            }

            var oFormatOptions = {
                groupingBaseSize: 3,
                groupingSize: 2,
                minIntegerDigits: 1,
                minFractionDigits: 2,
                maxFractionDigits: 2
            };

            var oFloatFormat = sap.ui.core.format.NumberFormat.getFloatInstance(oFormatOptions);
            return oFloatFormat.format(numericValue);
        },

        NotificationNumber: function (currencyOrValue, totalAmount, amountInINR) {
            var avalue;

            // If only one argument passed, treat it as value to format
            if (totalAmount === undefined && amountInINR === undefined) {
                avalue = currencyOrValue;
            } else {
                // Multiparameter call from multi-part binding
                avalue = currencyOrValue === "INR" ? totalAmount : amountInINR;
            }

            if (avalue === "0" || avalue === 0) {
                return "- -";
            }
            var numericValue = parseFloat(avalue);
            if (isNaN(numericValue)) {
                return "";
            }

            var oFormatOptions = {
                groupingBaseSize: 3,
                groupingSize: 2,
                minIntegerDigits: 1,
                minFractionDigits: 2,
                maxFractionDigits: 2
            };

            var oFloatFormat = sap.ui.core.format.NumberFormat.getFloatInstance(oFormatOptions);
            return oFloatFormat.format(numericValue) + " INR";
        },


        bytesToMB: function (bytes) {
            if (!bytes || isNaN(bytes)) {
                return "0 MB";
            }

            const mb = bytes / (1024 * 1024);
            return mb.toFixed(2) + " MB";
        },

        YearlyToMontlyConv: function (value) {
            var Data = parseFloat(value);
            if (isNaN(Data)) {
                return "INR 0.00";
            }
            var oFormatOptions = {
                groupingBaseSize: 3,
                groupingSize: 2,
                minIntegerDigits: 1,
                minFractionDigits: 2,
                maxFractionDigits: 2
            };

            var oFloatFormat = sap.ui.core.format.NumberFormat.getFloatInstance(oFormatOptions);
            // return oFloatFormat.format(numericValue);
            var monthlyValue = Data / 12;
            return "INR " + oFloatFormat.format(monthlyValue);
        },

        formatGradeWithType: function (sGrade, sGradeType) {
            if (!sGrade || isNaN(sGrade)) return "";
            var formattedGrade = parseFloat(sGrade).toFixed(2);
            if (sGradeType === "Percentage") {
                return formattedGrade + " %";
            } else if (sGradeType === "CGPA") {
                return formattedGrade + " CGPA";
            } else {
                return formattedGrade;
            }
        },

        getImageSrc: function (base64Str) {
            if (base64Str) {
                return "data:image/png;base64," + base64Str;
            }
            return ""; // fallback
        },

        statusState: function (Status) {
            if (Status === "Active") {
                return "Success";
            } else {
                return "Error";
            }
        },

        formatTimelineDate: function (status, creationDate, assignedDate, returnDate, trashDate, transferDate) {
            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });

            if (status === "Assigned" && assignedDate) {
                return oDateFormat.format(new Date(assignedDate));
            }
            else if (status === "Returned" && returnDate) {
                return oDateFormat.format(new Date(returnDate))

            } else if (status === "Trashed" && trashDate) {
                return oDateFormat.format(new Date(trashDate))

            }
            else if (status === "Transferred" && transferDate) {
                return oDateFormat.format(new Date(transferDate))

            }
            else if (creationDate) {
                return oDateFormat.format(new Date(creationDate))
            }

            else {
                return "Date not available";
            }
        },

        formatCustomerTypeValue: function (sType, sValue) {
            if (sValue && sValue !== "") {
                return `${sType} (${sValue}%)`;
            }
            return sType;
        },

        formatId: function (status, pickId, assigneId) {
            if (status === "Assigned" && assigneId) {
                return assigneId;
            } else if (status === "Available" && pickId) {
                return pickId;
            } else {
                return " ";
            }
        },

        formatName: function (status, pickName, assigneByName, assigneName) {
            if (status === "Assigned" && assigneByName) {
                return assigneByName;
            } else if (status === "Available" && pickName) {
                return pickName;
            } else if (status === "Returned" && assigneName) {
                return assigneName;

            }
        },

        LPAattach: function (sValue) {
            if (!sValue && sValue !== 0) {
                return "";
            }
            return sValue + " LPA";
        },

        ExperienceFormat: function (sValue) {
            if (!sValue || sValue === "0") {
                return "Fresher";
            }
            return sValue;
        },

        combineTitle: function (invoiceForText, status) {
            if (!invoiceForText) invoiceForText = "";
            if (!status) status = "";
            return invoiceForText + " '" + status + "'";
        },
        formatAmountWithCurrency: function (amount, currency) {

            // If amount is missing or not a number → show placeholder
            if (amount === null || amount === undefined || amount === "" || isNaN(amount) || amount === 0) {
                return "-- ";
            }

            // Convert amount safely to number
            var numericValue = parseFloat(amount);

            // Define formatting options
            var oFormatOptions = {
                groupingBaseSize: 3,
                groupingSize: 2,
                minIntegerDigits: 1,
                minFractionDigits: 2,
                maxFractionDigits: 2
            };

            // Create number formatter
            var oFloatFormat = sap.ui.core.format.NumberFormat.getFloatInstance(oFormatOptions);

            // Format amount + add currency
            return oFloatFormat.format(numericValue) + " " + (currency || "");
        },

        formatExtendedDates: function (sDates) {
            if (!sDates) return "";

            // Split by comma
            var aDates = sDates.split(",");

            // Trim spaces
            aDates = aDates.map(function (sDate) {
                return sDate.trim();
            });
            var sText = "";
            if (aDates[0]) sText += "First Date: " + aDates[0];

            if (aDates[1]) sText += "\nSecond Date: " + aDates[1];

            return sText;
        },

        paymentOrActualAmount: function (paymentAmount, currency) {
            var value = Number(paymentAmount || 0);
            if (isNaN(value)) return "- -";

            var oFloatFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
                groupingBaseSize: 3,
                groupingSize: 2,
                minIntegerDigits: 1,
                minFractionDigits: 2,
                maxFractionDigits: 2 // ✅ FIX
            });

            return oFloatFormat.format(value) + (currency ? " " + currency : "");
        },
        formatAddress: function (address, city, country) {
            let fullAddress =
                (address || "") + " " +
                (city || "") + " " +
                (country || "");

            // 🔥 break after 100 characters
            return fullAddress.replace(/(.{60})/g, "$1\n");
        },

        formatLeaveText: function (start, end, days, session) {
            if (!start || !end || !days) return "";

            days = parseFloat(days);

            let text = "";

            // Half day (0.5)
            if (days === 0.5) {
                text = `0.5 day - ${session}`;
            }
            // Other decimals (1.5, 2.5...)
            else if (days % 1 !== 0) {
                text = `${days} days - ${session}`;
            }
            // Full days (1, 2...)
            else {
                const dayText = days === 1 ? "day" : "days";
                text = `${days} ${dayText}`;
            }

            return `${start} to ${end} (${text})`;
        },

        formatPercentage: function (sType, value) {
            if (value !== null && value !== undefined && value !== "") {
                return sType + " (" +" "+ value +  "%" + " " +")";
            }
            return sType || "";
        },

        getDateWithDay: function (sDate) {
            if (!sDate) {
                return "";
            }

            let oDate;

            // Handle DD/MM/YYYY format
            if (typeof sDate === "string" && sDate.includes("/")) {
                var parts = sDate.split("/");
                if (parts.length === 3) {
                    oDate = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            } else {
                // Fallback (ISO / timestamp)
                oDate = new Date(sDate);
            }

            if (!oDate || isNaN(oDate)) {
                return sDate; // fallback: return original value
            }

            var aDays = [
                "Sunday", "Monday", "Tuesday",
                "Wednesday", "Thursday", "Friday", "Saturday"
            ];

            var sDayName = aDays[oDate.getDay()];

            // Format date back to DD/MM/YYYY
            var dd = String(oDate.getDate()).padStart(2, '0');
            var mm = String(oDate.getMonth() + 1).padStart(2, '0');
            var yyyy = oDate.getFullYear();

            return dd + "/" + mm + "/" + yyyy + " (" + sDayName + ")";
        },

        formatEditDateTime: function (sDateTime) {

            if (!sDateTime) {

                return "";
            }

            // Remove Z
            sDateTime = sDateTime.replace("Z", "");

            // Split Date & Time
            var aSplit =
                sDateTime.split("T");

            if (aSplit.length < 2) {

                return sDateTime;
            }

            // Date Part
            var sDate =
                aSplit[0];

            // Time Part
            var sTime =
                aSplit[1].substring(0, 5);

            return sDate + " " + sTime;
        },
           
    }
});
