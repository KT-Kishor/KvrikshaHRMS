sap.ui.define([
    "./BaseController", //call base controller
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../utils/validation",
    "sap/ui/model/odata/type/Currency",
    "../model/formatter",
],
    function (BaseController, JSONModel, MessageToast, utils, Currency, Formatter) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.ExpenseInvoiceDetail", {
            Formatter: Formatter,
            onInit: function () {
                this.getRouter().getRoute("ExpenseInvoiceDetail").attachMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: async function (oEvent) {
                var LoginFUnction = await this.commonLoginFunction("ExpenseInvoice");//CompanyInvoice
                if (!LoginFUnction) return;
                var sArg = oEvent.getParameter("arguments").sPath;
                if (!(await this.commonLoginFunction("ExpenseInvoice"))) return;//CompanyInvoice
                this.scrollToSection("EID_id_CmpInvObjectPageLayout", "EID_id_CmpInvGoals");
                if (!this.getView().getModel("CCMailModel")) this._fetchCommonData("EmailContent", "CCMailModel", { Type: "ExpenseInvoice", Action: "CC" });//CompanyInvoice
                this._makeDatePickersReadOnly(["EID_id_Invoice", "EID_id_Payby", "EID_id_NavInvoice", "EID_id_NavPayby", "CI_Id_Status", "EID_id_CurrencySelect"]);

                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                this.loginModel = this.getView().getModel("LoginModel");
                this.decodedPath = decodeURIComponent(decodeURIComponent(sArg));
                this.Discount = true;
                this.RateUnit = true;
                this.Particulars = true;
                this.mobileNo = true;
                this.ResivedTDSFlag = true;
                this.byId("EID_id_AddCustComboBox").setValueState("None");
                this.byId("EID_id_InvoiceDesc").setValueState("None");
                this.byId("EID_id_SowPO").setValueState("None");
                this.byId("EID_id_ConversionRate").setValueState("None");
                this.byId("EID_id_InputMailID").setValueState("None");
                // this.byId("EID_id_IncomeTaxPercentage").setValueState("None");
                this.byId("EID_id_SowDetails").setValueState("None");
                this.byId("EID_id_CurrencySelect").setEditable(true);
                const oView = this.getView();
                if (this.getView().getModel("CompanyInvoiceModel")) {
                    if (this.getView().getModel("CompanyInvoiceModel").getData().length === 0) {
                        var LastInvoiceDate = new Date()
                    } else {
                        var LastInvoiceDate = new Date(this.getView().getModel("CompanyInvoiceModel").getData()[0].InvoiceDate)
                    }
                }
                oView.setModel(new JSONModel({
                    CustomerName: "", InvNo: "", InvoiceDate: "", Name: "", PAN: "", GST: "", Address: "", MailID: "", MobileNo: "",
                    SOWDetails: "", Type: "", InvoiceDescription: "", Currency: "INR", PayByDate: "", POSOW: "", Status: "Submitted",
                    SubTotalNotGST: "0", SubTotalInGST: "0", LUT: "", IncomePerc: "10"
                }), "SelectedCustomerModel");

                this.SelectedCustomerModel = oView.getModel("SelectedCustomerModel");

                oView.setModel(new JSONModel({
                    results: [], InvNo: this.newID, IndexNo: "", ItemID: "", UnitText: "", Particulars: "", SAC: "", Rate: "", Currency: "INR",
                    Total: "", gstAmount: "", TotalAmount: "", subTotal: ""
                }), "FilteredSOWModel");

                oView.setModel(new JSONModel({
                    createVisi: true, editVisi: false, editable: true, igstVisi: false, gstVisiable: false,
                    flexVisiable: false, CInvoice: false, addInvBtn: true, merge: false, GST: true, payByDate: false,
                    Form: true, Table: false, MultiEmail: true, Edit: true, IncomeTax: true, minDate: LastInvoiceDate
                }), "visiablityPlay");

                var SowDataModel = new JSONModel({ items: [] });
                this.getView().setModel(SowDataModel, "CombinedData");
                this.visiablityPlay = oView.getModel("visiablityPlay");
                this.visiablityPlay.setProperty("/Edit", false);
                this.visiablityPlay.setProperty("/MultiEmail", false);
                this.visiablityPlay.setProperty("/merge", false);
                oView.setModel(new JSONModel(), "ExpenseInvoiceItemModel");
                this.byId("EID_id_TableInvoiceItem").setMode("Delete");

                //  if (sArg === "X") {
                //     this.byId("EID_id_CompanyCode").setEditable(true);
                // } else {
                //     this.byId("EID_id_CompanyCode").setEditable(false);
                // }
                this.Update = false;
                if (sArg === "X") return;
                this.visiablityPlay.setProperty("/Edit", true);
                this.visiablityPlay.setProperty("/flexVisiable", true);
                this.visiablityPlay.setProperty("/createVisi", false);
                this.visiablityPlay.setProperty("/editVisi", true);
                this.visiablityPlay.setProperty("/editable", false);
                this.visiablityPlay.setProperty("/addInvBtn", false);
                this.visiablityPlay.setProperty("/MultiEmail", false);
                this.byId("EID_id_TableInvoiceItem").setMode("None");
                this.byId("EID_id_CurrencySelect").setEditable(false);
                this.visiablityPlay.setProperty("/merge", true);
                this.visiablityPlay.setProperty("/MultiEmail", true);

                this.getBusyDialog();

                try {
                    const oData = await this.ajaxReadWithJQuery("ExpenseInvoiceItem", { InvNo: this.decodedPath });
                    this.Update = true;
                    if (!oData.success) throw new Error("Invalid data structure");

                    var oHeader = oData.data.ExpenseInvoice?.[0] || {};//CompanyInvoice
                    this.byId("EID_id_Payby").setMinDate(new Date(oHeader.InvoiceDate));
                    this.byId("EID_id_NavPayby").setMinDate(new Date(oHeader.InvoiceDate));
                    oHeader.InvoiceDate = this.Formatter.formatDate(oHeader.InvoiceDate);
                    var PayByDate = oHeader.PayByDate;
                    oHeader.PayByDate = this.Formatter.formatDate(oHeader.PayByDate);

                    this.SelectedCustomerModel.setData(oHeader);

                    const aItems = oData.data.ExpenseInvoiceItem.map((item, index) => ({ ...item, IndexNo: index + 1 }));
                    oView.setModel(new JSONModel({ ExpenseInvoiceItem: aItems }), "ExpenseInvoiceItemModel");

                    const { IGST = "0", SGST = "0", CGST = "0", Value, Currency, Status, InvNo } = oHeader;
                    this.getView().getModel("FilteredSOWModel").setProperty("/Currency", Currency);
                    if (IGST === "0") {
                        this.visiablityPlay.setProperty("/igstVisi", false);
                        this.visiablityPlay.setProperty("/gstVisiable", true);
                    } else {
                        this.visiablityPlay.setProperty("/igstVisi", true);
                        this.visiablityPlay.setProperty("/gstVisiable", false);
                    }

                    if (IGST === "0" && SGST === "0" && CGST === "0") {
                        this.visiablityPlay.setProperty("/igstVisi", false);
                        this.visiablityPlay.setProperty("/gstVisiable", false);
                    }

                    if (Value == null) {
                        this.visiablityPlay.setProperty("/igstVisi", false);
                        this.visiablityPlay.setProperty("/gstVisiable", false);
                    }

                    if (Currency !== "INR") {
                        this.visiablityPlay.setProperty("/GST", false);
                        this.byId("EIdSAC")?.setVisible(false);
                        this.byId("EIdGSTCalculation")?.setVisible(false);
                        this.visiablityPlay.setProperty("/TDS", false);
                    } else {
                        this.visiablityPlay.setProperty("/GST", true);
                        this.byId("EIdSAC")?.setVisible(true);
                        this.byId("EIdGSTCalculation")?.setVisible(true);
                        this.visiablityPlay.setProperty("/TDS", true);
                    }

                    if (PayByDate) {
                        const payByDate = new Date(PayByDate);
                        const today = new Date();
                        const daysDiff = Math.ceil((payByDate - today) / (1000 * 60 * 60 * 24));
                        const showReminder = daysDiff <= 10;
                        this.visiablityPlay.setProperty("/payByDate", showReminder);
                        this.ReminderEmail = showReminder;
                    }

                    if (Status === "Payment Received") {
                        this.visiablityPlay.setProperty("/payByDate", false);
                        this.visiablityPlay.setProperty("/createVisi", false);
                        this.visiablityPlay.setProperty("/Edit", false);
                        this.visiablityPlay.setProperty("/MultiEmail", false);
                    }
                    this.Status = Status;
                    this.totalAmountCalculation();
                    this.Readcall("ExpenseInvoicePaymentDetail", { InvNo: this.decodedPath })
                } catch (error) {
                    MessageToast.show(error.responseText || "Failed to load invoice data.");
                } finally {
                    this.closeBusyDialog();
                }


            },

            onLogout: function () {
                this.CommonLogoutFunction();
            },

            onChangeAddCustomer: async function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent);
                this.SelectKey = oEvent.getSource().getSelectedKey();
                var SelectedData = this.getView().getModel("ManageCustomerModel").getData().filter((item) => item.ID === this.SelectKey)[0];
                if (!SelectedData) return;
                this.getBusyDialog();
                this.SelectedCustomerModel.setProperty("/IncomeTax", "0.00");
                this.SelectedCustomerModel.setProperty("/SubTotalNotGST", "0.00");
                this.SelectedCustomerModel.setProperty("/SubTotalInGST", "0.00");
                this.SelectedCustomerModel.setProperty("/gstAmount", "0.00");
                this.SelectedCustomerModel.setProperty("/PayByDate", "");
                this.SelectedCustomerModel.setProperty("/InvoiceDate", "");
                this.getView().getModel("FilteredSOWModel").setProperty("/TotalAmount", "0.00");
                this.SelectedCustomerModel.setProperty("/AllDueAmount", "0.00");
                this.SelectedCustomerModel.setProperty("/AllReceivedAmount", "0.00");
                this.SelectedCustomerModel.setProperty("/AllReceivedTDS", "0.00");
                this.SelectedCustomerModel.setProperty("/Name", SelectedData.name);
                this.SelectedCustomerModel.setProperty("/PAN", SelectedData.PAN);
                this.SelectedCustomerModel.setProperty("/GST", SelectedData.GST);
                this.SelectedCustomerModel.setProperty("/Address", SelectedData.address + " ," + SelectedData.baseLocation + " ," + SelectedData.country);
                this.SelectedCustomerModel.setProperty("/MailID", SelectedData.mailID);
                this.SelectedCustomerModel.setProperty("/MobileNo", SelectedData.mobileNo);
                this.SelectedCustomerModel.setProperty("/Type", SelectedData.type);
                this.SelectedCustomerModel.setProperty("/Value", SelectedData.value);
                this.SelectedCustomerModel.setProperty("/CompanyCode", SelectedData.CompanyCode);
                this.getView().getModel("ExpenseInvoiceItemModel").setProperty("/ExpenseInvoiceItem", []);
                this.byId("EID_id_SowDetails").setValue("").setSelectedKey("")
                this.SelectedCustomerModel.refresh(true)
                await this.ajaxCreateWithJQuery("combineSowMsa", { MsaID: this.SelectKey }).then((oData) => {
                    if (oData.success) {
                        this.getView().getModel("CombinedData").setProperty("/items", oData.combinedData);
                        this.closeBusyDialog();
                        this.onChangeInvoiceDate();
                    }
                }).catch((error) => {
                    this.closeBusyDialog();
                    MessageToast.show(error.responseText);
                });
            },

            onChangeInvoiceDate: async function (oEvent) {
                if (oEvent) {
                    utils._LCvalidateDate(oEvent);
                    this.byId("EID_id_Payby").setMinDate(new Date(oEvent.getSource().getValue().split('/').reverse().join('-')));
                    this.byId("EID_id_NavPayby").setMinDate(new Date(oEvent.getSource().getValue().split('/').reverse().join('-')));
                }
                this.getBusyDialog();
                const oData = await this.ajaxReadWithJQuery("MSADetails", { MsaID: this.SelectKey });
                const oSelectedCustomerModel = this.getView().getModel("SelectedCustomerModel");
                if (oData.success && oData.data.length !== 0) {
                    var paymentDateObj = new Date(oSelectedCustomerModel.getData().InvoiceDate);
                    var paymentDay = parseInt(oData.data[0].PaymentTerms);
                    paymentDateObj.setDate(paymentDateObj.getDate() + (paymentDay - 1));
                    oSelectedCustomerModel.setProperty("/PayByDate", paymentDateObj);
                    this.closeBusyDialog();
                } else {
                    var currentDate = new Date();
                    currentDate.setDate(currentDate.getDate() + 30);
                    oSelectedCustomerModel.setProperty("/PayByDate", currentDate);
                    this.closeBusyDialog();
                }
            },

            onPayByDateDatePickerChange: function (oEvent) {
                utils._LCvalidateDate(oEvent);
            },

            OnChangeSowDetails: async function (oEvent) {
                if (oEvent) {
                    utils._LCvalidationComboBox(oEvent);
                }
                this.byId("EID_id_SowPO").setValueState("None");
                const sSelectedKey = oEvent.getSource().getSelectedKey();
                if (!sSelectedKey) {
                    this.byId("EID_id_CurrencySelect").setEditable(true);
                }
                const oView = this.getView();
                const oSelectedCustomerModel = oView.getModel("SelectedCustomerModel");
                const oFilteredSOWModel = oView.getModel("FilteredSOWModel");

                const resetFields = () => {
                    oFilteredSOWModel.setProperty("/Currency", "INR");
                    this.byId("EIdSAC").setVisible(true);
                    this.byId("EIdGSTCalculation").setVisible(true);
                    oSelectedCustomerModel.setProperty("/POSOW", "");
                    this.byId("idCurrencySelect").setEditable(true);
                    oFilteredSOWModel.setProperty("/gstAmount", "0");
                    oFilteredSOWModel.setProperty("/TotalAmount", "0");
                    oSelectedCustomerModel.setProperty("/SubTotalInGST", "0");
                    oSelectedCustomerModel.setProperty("/SubTotalNotGST", "0");
                };
                if (sSelectedKey === ' - ') { resetFields(); return; }
                this.getBusyDialog();
                try {
                    const [msaID, sowID] = sSelectedKey.split(' - ');
                    const oData = await this.ajaxReadWithJQuery("SowDetails", { MsaID: msaID, SowID: sowID, Status: "Active" });

                    if (!oData.success) return;

                    const unitMultiplier = { Day: 20, Month: 1, Hour: 168, Bid: 1 };
                    let aFilteredSOWDetails = [];
                    this.itemIDCounter = 1;

                    oData.data.forEach((oSOW) => {
                        if (oSOW.MsaID !== msaID) return;

                        const [rateValue, currency, a, b, unit] = oSOW.Rate.split(" ");
                        const multiplier = unitMultiplier[(currency === "INR") ? unit : b] || 0;
                        const rate = (isNaN(parseFloat(rateValue)) || parseFloat(rateValue) === 0) ? 1 : parseFloat(rateValue);
                        const factor = (isNaN(parseFloat(multiplier)) || parseFloat(multiplier) === 0) ? 1 : parseFloat(multiplier);

                        const total = rate * factor;

                        aFilteredSOWDetails.push({
                            ...oSOW,
                            IndexNo: this.itemIDCounter++,
                            InvNo: this.newID,
                            Particulars: oSOW.ConsultantName,
                            SAC: "998314",
                            GSTCalculation: (currency === "INR") ? "YES" : "",
                            Unit: multiplier,
                            UnitText: (currency === "INR") ? b + " " + unit : a + " " + b,
                            Rate: rateValue,
                            Currency: currency,
                            Discount: "",
                            Total: total,
                        });
                    });

                    oFilteredSOWModel.setProperty("/Currency", aFilteredSOWDetails[0]?.Currency || "INR");

                    this.getView().getModel("ExpenseInvoiceItemModel").setProperty("/ExpenseInvoiceItem", aFilteredSOWDetails);
                    this.visiablityPlay.setProperty("/flexVisiable", true);
                    this.byId("EID_id_CurrencySelect").setEditable(false);
                    oSelectedCustomerModel.setProperty("/POSOW", "SOW");

                    const isINR = oFilteredSOWModel.getProperty("/Currency") === "INR";
                    // this.byId("EIdSAC").setVisible(isINR);
                    // this.byId("EIdGSTCalculation").setVisible(isINR);
                    this.visiablityPlay.setProperty("/IncomeTax", isINR);
                    this.visiablityPlay.setProperty("/TDS", isINR);
                    this.visiablityPlay.setProperty("/GST", isINR);
                    oSelectedCustomerModel.setProperty("/type", isINR ? this.Type : "");
                    if (!oSelectedCustomerModel.getProperty("/GST")) {
                        this.visiablityPlay.setProperty("/GST", false);
                    }
                    if (isINR && !oSelectedCustomerModel.getProperty("/GST")) {
                        oSelectedCustomerModel.setProperty("/Value", '9');
                        oSelectedCustomerModel.setProperty("/Type", 'CGST/SGST');
                        this.visiablityPlay.setProperty("/GST", true);
                    }

                    await this.totalAmountCalculation();
                    if (isINR) {
                        const oModel = oSelectedCustomerModel;
                        const oData = oModel.getData();

                        const subTotalInGST = parseFloat(oData.SubTotalInGST) || 0;
                        const subTotalNotGST = parseFloat(oData.SubTotalNotGST) || 0;
                        const incomePerc = parseFloat(oData.IncomePerc) || 0;

                        const total = subTotalInGST + subTotalNotGST;
                        const tds = ((total * incomePerc) / 100).toFixed(2);
                        oModel.setProperty("/IncomeTax", Math.round(tds));
                    }
                    this.visiablityPlay.refresh(true);
                } catch (error) {
                    MessageToast.show(error.responseText);
                } finally {
                    this.closeBusyDialog();
                }
            },

            CID_onPressAddInvoiceItems: function () {
                const oView = this.getView();
                const oItemModel = oView.getModel("ExpenseInvoiceItemModel");
                let oData = oItemModel.getProperty("/ExpenseInvoiceItem") || [];
                // Generate new invoice item
                const currency = this.byId("EID_id_CurrencySelect").getValue();
                const newItem = {
                    IndexNo: oData.length ? oData[oData.length - 1].IndexNo + 1 : 1,
                    Particulars: "",
                    SAC: "998314",
                    GSTCalculation: (currency === "INR") ? "YES" : "",
                    Unit: "1",
                    Rate: "",
                    UnitText: "Per Day",
                    Currency: currency,
                    Discount: "",
                    Total: "",
                };
                if (this.Update) {
                    newItem.flag = "create";
                }
                // Add and update model
                oData.push(newItem);
                oItemModel.setProperty("/ExpenseInvoiceItem", oData);
            },

            CI_On_ChangeRateType: function (oEvent) {
                var data = oEvent.getSource().getSelectedItem().getBindingContext("ExpenseInvoiceItemModel").getObject();

                switch (data.UnitText) {
                    case 'Per Day':
                        data.Unit = 20;
                        break;
                    case 'Per Month':
                        data.Unit = 1;
                        break;
                    case 'Per Hour':
                        data.Unit = 168;
                        break;
                    case 'Fixed Bid':
                        data.Unit = 1;
                        break;
                    default:
                        data.Unit = 1;
                }
                // Optionally update the model (if using two-way binding or need manual update)
                this.getView().getModel("ExpenseInvoiceItemModel").refresh(true);
                this.totalAmountCalculation();
            },

            totalAmountCalculation: function () {
                const oView = this.getView();
                const oSOWModel = oView.getModel("FilteredSOWModel");
                const oInvoiceModel = oView.getModel("ExpenseInvoiceItemModel");
                const oCustomerModel = oView.getModel("SelectedCustomerModel");
                let aSOWDetails = oInvoiceModel.getProperty("/ExpenseInvoiceItem") || [];
                let totalWithGST = 0;
                let totalWithoutGST = 0;

                aSOWDetails.forEach((item) => {
                    if (oSOWModel.getProperty("/Currency") === "INR" && !oCustomerModel.getProperty("/GST")) {
                        oCustomerModel.setProperty("/Value", '9');
                        oCustomerModel.setProperty("/Type", 'CGST/SGST');
                        this.visiablityPlay.setProperty("/GST", true);
                    }
                    const rate = (isNaN(parseFloat(item.Rate)) || parseFloat(item.Rate) === 0) ? 1 : parseFloat(item.Rate);
                    const unit = (isNaN(parseFloat(item.Unit)) || parseFloat(item.Unit) === 0) ? 1 : parseFloat(item.Unit);
                    const baseAmount = unit * rate;
                    item.Unit = unit
                    let discountAmount = 0;

                    // Check if discount is in percentage format
                    if (typeof item.Discount === "string" && item.Discount.trim().endsWith("%")) {
                        const percent = parseFloat(item.Discount) / 100;
                        discountAmount = baseAmount * percent;
                    } else {
                        discountAmount = parseFloat(item.Discount) || 0;
                    }

                    // ✅ NEW: If discount > rate OR discount > baseAmount, reset discount to 0
                    if (discountAmount > baseAmount) {
                        discountAmount = 0;
                        item.Discount = "0.00";
                    } else {
                        item.Discount = discountAmount.toFixed(2);
                    }

                    let finalAmount = baseAmount - discountAmount;
                    item.Total = finalAmount.toFixed(2);

                    const isGSTApplicable = item.GSTCalculation === "YES" && oSOWModel.getProperty("/Currency") === "INR";
                    item.SAC = isGSTApplicable ? "998314" : "-";

                    if (isGSTApplicable) {
                        totalWithGST += finalAmount;
                    } else {
                        totalWithoutGST += finalAmount;
                    }
                });

                const subTotalGST = totalWithGST.toFixed(2);
                const subTotalNoGST = totalWithoutGST.toFixed(2);
                const subtotal = (totalWithGST + totalWithoutGST).toFixed(2);

                oCustomerModel.setProperty("/SubTotalInGST", subTotalGST);
                oCustomerModel.setProperty("/SubTotalNotGST", subTotalNoGST);
                oCustomerModel.setProperty("/AmountInINR", subTotalGST);
                oSOWModel.setProperty("/subTotal", subtotal);

                const type = oCustomerModel.getProperty("/Type");
                const taxRate = 0;
                let gstAmount = 0, finalAmount = totalWithGST + totalWithoutGST;

                if (type === "CGST/SGST") {
                    gstAmount = (totalWithGST * taxRate) / 100;
                    finalAmount += gstAmount * 2;
                    oCustomerModel.setProperty("/CGST", gstAmount.toFixed(2));
                    oCustomerModel.setProperty("/SGST", gstAmount.toFixed(2));
                } else if (type === "IGST") {
                    gstAmount = (totalWithGST * taxRate) / 100;
                    finalAmount += gstAmount;
                    oCustomerModel.setProperty("/IGST", gstAmount.toFixed(2));
                }

                let roundedAmount = Math.round(finalAmount);
                let difference = (roundedAmount - finalAmount).toFixed(2);
                let RoundOf = difference > 0 ? `+${difference}` : difference;

                oSOWModel.setProperty("/RoundOf", RoundOf);
                oSOWModel.setProperty("/TotalAmount", roundedAmount.toFixed(2));
                oSOWModel.setProperty("/gstAmount", gstAmount.toFixed(2));
                oCustomerModel.setProperty("/TotalAmount", roundedAmount.toFixed(2));
                oInvoiceModel.refresh(true);
                this.onChangeConversionRate();
            },

            Comp_onChangeGSTCalculation: function (oEvent) { this.totalAmountCalculation(); },

            onChangeConversionRate: function (oEvent) {
                if (oEvent) {
                    utils._LCvalidateAmount(oEvent);
                }
                var oModel = this.getView().getModel("FilteredSOWModel").getData().subTotal;
                var value = this.getView().getModel("SelectedCustomerModel");
                var data = parseFloat(value.getData().ConversionRate) * parseFloat(oModel);
                value.setProperty("/AmountInFCurrency", parseFloat(data).toFixed(2));
            },

            onChangeSowDetailsCal: async function (oEvent) {
                this.RateUnit = utils._LCvalidateAmount(oEvent);
                const oInput = oEvent.getSource();
                const oRowContext = oInput.getBindingContext("ExpenseInvoiceItemModel");
                if (!oRowContext) return;

                const oSOW = oRowContext.getObject();
                const rate = parseFloat(oSOW.Rate) || 0;
                const unit = parseFloat(oSOW.Unit) || 0;
                const discount = parseFloat(oSOW.Discount) || 0;

                let iTotal = unit ? rate * unit : rate;
                iTotal -= discount;

                const sTotalPath = oRowContext.getPath() + "/Total";
                oRowContext.getModel().setProperty(sTotalPath, isNaN(iTotal) ? 0 : iTotal.toFixed(2));

                this.visiablityPlay.setProperty("/flexVisiable", true);

                await this.totalAmountCalculation();

                const oNavigationModel = this.getView().getModel("SelectedCustomerModel");
                const oNavigationData = oNavigationModel.getData();

                if (oNavigationData.Currency === "INR") {
                    const subTotalInGST = parseFloat(oNavigationData.SubTotalInGST) || 0;
                    const subTotalNotGST = parseFloat(oNavigationData.SubTotalNotGST) || 0;
                    const incomePerc = parseFloat(oNavigationData.IncomePerc) || 0;

                    const totalAmount = subTotalInGST + subTotalNotGST;
                    const tds = ((totalAmount * incomePerc) / 100).toFixed(2);

                    oNavigationModel.setProperty("/IncomeTax", Math.round(tds));
                } else {
                    oNavigationModel.setProperty("/IncomeTax", "0.00");
                }
            },

            onParticularsInputLiveChange: function (oEvent) {
                this.Particulars = utils._LCvalidateMandatoryField(oEvent);
            },

            Comp_OnChangeDiscount: async function (oEvent) {
                var sValue = oEvent.getParameter("value").trim();
                var regex = /^[0-9]+(\.[0-9]{1,2})?%?$/;
                var oInput = oEvent.getSource();
                sValue = sValue.replace(/[^0-9.%]/g, "");

                var isPercentage = sValue.indexOf('%') !== -1;
                if (isPercentage) {
                    sValue = sValue.replace('%', '');
                }

                var parts = sValue.split('.');
                if (parts.length > 1) {
                    parts[1] = parts[1].substring(0, 2);
                    sValue = parts.join('.');
                }

                if (isPercentage) {
                    sValue = sValue + '%';
                }
                oInput.setValue(sValue);
                await this.totalAmountCalculation();
                if (!sValue) {
                    oInput.setValueState("None");
                    oInput.setValueStateText("");
                    // this.CI_updateTotalAmount();
                    this.Discount = true;
                } else if (!regex.test(sValue)) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText(this.i18nModel.getText("discountValueText"));
                    this.Discount = false;
                } else {
                    oInput.setValueState("None");
                    oInput.setValueStateText("");
                    this.Discount = true;
                }

                var oNavigationModel = this.getView().getModel("SelectedCustomerModel");
                var oData = oNavigationModel.getData();

                if (oData.Currency === "INR") {
                    var subTotalInGST = parseFloat(oData.SubTotalInGST) || 0;
                    var subTotalNotGST = parseFloat(oData.SubTotalNotGST) || 0;
                    var incomePerc = parseFloat(oData.IncomePerc) || 0;

                    var tds = ((subTotalInGST + subTotalNotGST) * incomePerc / 100).toFixed(2);
                    oNavigationModel.setProperty("/IncomeTax", Math.round(tds));
                }
            },
            CID_onPressAddCustomer: function () {
                this.getView().getModel("LoginModel").setProperty("/RichText", false);
                this.getRouter().navTo("RouteManageCustomer", { value: "Data" });
            },

            CID_onPressMSAandSOW: function () {
                this.getView().getModel("LoginModel").setProperty("/RichText", false);
                if (this.SelectKey) {
                    this.getRouter().navTo("RouteMSAEdit", { sPath: this.SelectKey });
                } else {
                    this.getRouter().navTo("RouteMSA",{
                    value: "MSA",
                    from:"Expensedetails"
                });
                }
            },

            EID_onPressback: function () {
                this.getView().getModel("LoginModel").setProperty("/RichText", false);
                this.getRouter().navTo("ExpenseInvoice",{
                    from:"ExpenseInvoicedet"
                })
            },

            CID_ValidateDate: function (oEvent) { utils._LCvalidateDate(oEvent) },

            CID_ValidateDatePayByDate: function (oEvent) {
                utils._LCvalidateDate(oEvent)
                var [day, month, year] = oEvent.getSource().getValue().split('/').map(Number);
                var payByDate = new Date(year, month - 1, day);
                var today = new Date();
                var timeDiff = payByDate - today;
                var daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                if (daysDiff <= 10) {
                    this.ReminderEmail = true;
                } else {
                    this.ReminderEmail = false;
                }
            },

            SubmitPayload: async function (sMode) {
                const oView = this.getView();
                const oSelectedCustomerModel = oView.getModel("SelectedCustomerModel").getData();
                const oExpenseInvoiceItemModel = oView.getModel("ExpenseInvoiceItemModel").getData();
                var FilterModel = this.getView().getModel("FilteredSOWModel").getData()

                const oModel = {
                    subTotal: oSelectedCustomerModel.SubTotalInGST,
                    gstAmount: oSelectedCustomerModel.gstAmount,
                    TotalAmount: oSelectedCustomerModel.TotalAmount
                };

                const oPayload = {
                    InvoiceDate: (sMode === 'update') ? oSelectedCustomerModel.InvoiceDate.split('/').reverse().join('-') : this.Formatter.formatDate(oSelectedCustomerModel.InvoiceDate).split('/').reverse().join('-') || "",
                    CustomerName: (sMode === 'update') ? oSelectedCustomerModel.CustomerName : oSelectedCustomerModel.Customer,
                    GST: oSelectedCustomerModel.GST != null ? String(oSelectedCustomerModel.GST) : '',
                    Address: String(oSelectedCustomerModel.Address),
                    PAN: String(oSelectedCustomerModel.PAN),
                    MobileNo: oSelectedCustomerModel.MobileNo != null ? String(oSelectedCustomerModel.MobileNo) : '',
                    AmountInFCurrency: FilterModel.Currency === "INR"
                        ? (!isNaN(oSelectedCustomerModel.AmountInFCurrency) ? oSelectedCustomerModel.AmountInFCurrency : "0")
                        : parseFloat(oModel.subTotal) || 0,
                    Currency: FilterModel.Currency,
                    ConversionRate: !isNaN(oSelectedCustomerModel.ConversionRate) ? parseFloat(oSelectedCustomerModel.ConversionRate) : 0,
                    AmountInINR: FilterModel.Currency === "INR"
                        ? parseFloat(oModel.subTotal) || 0
                        : parseFloat(oSelectedCustomerModel.AmountInFCurrency) || 0,
                    CGST: oSelectedCustomerModel.Type === "CGST/SGST" ? parseFloat(oSelectedCustomerModel.CGST) || 0 : 0,
                    SGST: oSelectedCustomerModel.Type === "CGST/SGST" ? parseFloat(oSelectedCustomerModel.SGST) || 0 : 0,
                    IGST: oSelectedCustomerModel.Type === "IGST" ? parseFloat(oSelectedCustomerModel.IGST) || 0 : 0,
                    TotalAmount: parseFloat(oModel.TotalAmount) || 0,
                    Status: oSelectedCustomerModel.Status,
                    InvoiceDescription: oSelectedCustomerModel.InvoiceDescription || "",
                    IncomeTax: (FilterModel.Currency === "INR") ? oSelectedCustomerModel.IncomeTax : "",
                    MailID: oSelectedCustomerModel.MailID,
                    Type: oSelectedCustomerModel.Type || "",
                    Value: (!oSelectedCustomerModel.Value || isNaN(oSelectedCustomerModel.Value)) ? "0" : oSelectedCustomerModel.Value,
                    PayByDate: (sMode === 'update') ? oSelectedCustomerModel.PayByDate.split('/').reverse().join('-') : oSelectedCustomerModel.PayByDate?.toISOString().split('T')[0] || "",
                    POSOW: oSelectedCustomerModel.POSOW,
                    SubTotalNotGST: parseFloat(oSelectedCustomerModel.SubTotalNotGST) || 0,
                    SubTotalInGST: parseFloat(oSelectedCustomerModel.SubTotalInGST) || 0,
                    LUT: String(oSelectedCustomerModel.LUT),
                    IncomePerc: (FilterModel.Currency === "INR") ? oSelectedCustomerModel.IncomePerc || "10" : "",
                    companyCode: this.byId("EID_id_CompanyCode").getValue()
                };
                const aItemsRaw = oExpenseInvoiceItemModel.ExpenseInvoiceItem || [];
                if (aItemsRaw.length === 0) {
                    this.getBusyDialog();
                    MessageToast.show(this.i18nModel.getText("companyTableValidation"));
                    return false;
                }
                for (let i = 0; i < aItemsRaw.length; i++) {
                    const item = aItemsRaw[i];
                    if (!item.Particulars || !item.Rate) {
                        this.getBusyDialog();
                        sap.m.MessageBox.error(`Please fill all mandatory fields (Particulars, Rate) in item row ${i + 1}`);
                        return false;
                    }
                }
                const aItems = aItemsRaw.map(item => {
                    const itemData = {
                        InvNo: oSelectedCustomerModel.InvNo,
                        SAC: item.SAC,
                        Unit: item.Unit,
                        UnitText: item.UnitText,
                        Particulars: item.Particulars,
                        Rate: item.Rate,
                        Total: item.Total,
                        Currency: item.Currency,
                        GSTCalculation: item.GSTCalculation,
                        Discount: item.Discount
                    };
                    if (sMode === "update") {
                        let filters;
                        if (item.flag === "create") {
                            filters = { flag: "create" };
                        } else {
                            filters = {
                                InvNo: oSelectedCustomerModel.InvNo,
                                ItemID: item.ItemID
                            };
                        }
                        return {
                            data: itemData,
                            filters: filters
                        };
                    } else {
                        return itemData;
                    }
                });
                const finalPayload = {
                    payload: oPayload
                };
                if (sMode === "update") {
                    finalPayload.filters = {
                        InvNo: oSelectedCustomerModel.InvNo,
                    };
                }
                finalPayload.items = aItems;
                return finalPayload;
            },

            CID_onPressSubmit: async function (oEvent) {
                try {
                    var that = this;
                    var oModel = this.getView().getModel("FilteredSOWModel").getData();
                    const bMandatoryValid =
                        // utils._LCvalidateMandatoryField(this.byId("EID_id_CompanyCode"), "ID") &&
                        utils._LCvalidateMandatoryField(this.byId("EID_id_AddCustComboBox"), "ID") &&
                        utils._LCvalidateDate(this.byId("EID_id_Invoice"), "ID") &&
                        utils._LCvalidateDate(this.byId("EID_id_Payby"), "ID") &&
                        utils._LCvalidateMandatoryField(this.byId("EID_id_InvoiceDesc"), "ID") &&
                        utils._LCvalidateMandatoryField(this.byId("EID_id_SowPO"), "ID") &&
                        utils._LCvalidateMandatoryField(this.byId("EID_id_CurrencySelect"), "ID");
                    // const bTDSValid = oModel.Currency === "INR" ? utils._LCvalidateVariablePay(this.byId("EID_id_IncomeTaxPercentage"), "ID") : true;
                    const bConversionRateValid = oModel.Currency !== "INR" ? utils._LCvalidateAmount(this.byId("EID_id_ConversionRate"), "ID") : true;
                    const bOptionalValid = this.Discount && this.RateUnit && this.Particulars;
                    const bIsValid = bMandatoryValid && bOptionalValid && bConversionRateValid;
                    if (!bIsValid) {
                        return MessageToast.show(this.i18nModel.getText("mandatoryFieldsError"));
                    }
                    this.getBusyDialog();
                    const oPayload = await this.SubmitPayload("Create");
                    if (oPayload === false) {
                        this.closeBusyDialog();
                        return;
                    }
                    try {
                        var response = await that.ajaxCreateWithJQuery("ExpenseInvoice", { data: oPayload.payload, Items: oPayload.items });//CompanyInvoice
                        const oSelectedCustomerModel = that.getView().getModel("SelectedCustomerModel");
                        oSelectedCustomerModel.setProperty("/InvNo", response.InvoiceNo);
                        var CustomerName = oSelectedCustomerModel.getProperty("/Customer");
                        oSelectedCustomerModel.setProperty("/CustomerName", CustomerName)
                        that.closeBusyDialog();
                        var oDialog = new sap.m.Dialog({
                            title: this.i18nModel.getText("success"),
                            type: sap.m.DialogType.Message,
                            state: sap.ui.core.ValueState.Success,
                            content: new sap.m.Text({
                                text: this.i18nModel.getText("invoiceCreatemsg")
                            }),
                            beginButton: new sap.m.Button({
                                text: "OK",
                                type: "Transparent",
                                press: function () {
                                    oDialog.close();
                                    that.getRouter().navTo("ExpenseInvoice",{
                                        from:"ExpenseInvoicedet"
                                    });
                                }
                            }),
                            endButton: new sap.m.Button({
                                text: "Generate PDF",
                                type: "Transparent",
                                press: function () {
                                    oDialog.close();
                                    that.CID_onPressGeneratePdf();
                                    that.getRouter().navTo("ExpenseInvoice",{
                                        from:"ExpenseInvoicedet"
                                    });
                                }
                            }),
                            afterClose: function () {
                                oDialog.destroy();
                            }
                        });
                        oDialog.open();
                    } catch (error) {
                        sap.m.MessageToast.show(error.responseText || "Submission failed");
                    }
                } catch (error) {
                    MessageToast.show(that.i18nModel.getText("technicalError"));
                }
            },

            CID_onPressEdit: function () {
                var isEditMode = this.visiablityPlay.getProperty("/editable");
                if (isEditMode) {
                    this.onPressUpdateInvoice();
                } else {
                    this.visiablityPlay.setProperty("/editable", true);
                    this.visiablityPlay.setProperty("/CInvoice", true);
                    this.byId("EID_id_TableInvoiceItem").setMode("Delete");
                    this.visiablityPlay.setProperty("/addInvBtn", true);
                    this.visiablityPlay.setProperty("/merge", false);
                    this.visiablityPlay.setProperty("/MultiEmail", false);
                    this.visiablityPlay.setProperty("/payByDate", false);
                }
            },
            CID_onPressLiveChangeEmail: function (oEvent) { utils._LCvalidateEmail(oEvent) },

            CID_onPressLiveChangeMobileNo: function (oEvent) {
                this.mobileNo = utils._LCvalidateMobileNumber(oEvent);
            },

            onPressUpdateInvoice: async function () {
                try {
                    var oModel = this.getView().getModel("FilteredSOWModel").getData();
                    const bIsValid =
                        utils._LCvalidateMandatoryField(this.byId("EID_id_InvoiceDesc"), "ID") && this.mobileNo &&
                        utils._LCvalidateMandatoryField(this.byId("EID_id_SowPO"), "ID") &&
                        utils._LCvalidateEmail(this.byId("EID_id_InputMailID"), "ID") &&
                        (!!this.RateUnit && !!this.Particulars)
                    // (oModel.Currency === "INR" ? utils._LCvalidateAmount(this.byId("EID_id_ConversionRate"), "ID") : utils._LCvalidateAmount(this.byId("EID_id_ConversionRate"), "ID"));

                    if (!bIsValid) {
                        return MessageToast.show(this.i18nModel.getText("mandatoryFieldsError"));
                    }

                    this.getBusyDialog();
                    const oPayload = await this.SubmitPayload("update");
                    if (oPayload === false) {
                        this.closeBusyDialog();
                        return;
                    } else {
                        var Status = oPayload.payload.Status;
                    }
                    try {
                        await this.ajaxUpdateWithJQuery("ExpenseInvoice", { data: oPayload.payload, filtres: oPayload.filters, Items: oPayload.items });//CompanyInvoice
                        this.visiablityPlay.setProperty("/editable", false);
                        this.visiablityPlay.setProperty("/CInvoice", false);
                        this.byId("EID_id_TableInvoiceItem").setMode("None");
                        this.visiablityPlay.setProperty("/addInvBtn", false);
                        this.visiablityPlay.setProperty("/merge", true);
                        this.visiablityPlay.setProperty("/MultiEmail", true);
                        if (Status !== "Payment Received") this.visiablityPlay.setProperty("/payByDate", this.ReminderEmail);
                        if (Status === "Payment Received") {
                            this.visiablityPlay.setProperty("/MultiEmail", false);
                            this.visiablityPlay.setProperty("/Edit", false);
                        }
                        MessageToast.show(this.i18nModel.getText("invoiceUpdateMess"));
                        this.closeBusyDialog();
                    } catch (error) {
                        this.closeBusyDialog();
                        MessageToast.show(error.responseText || this.i18nModel.getText("invoiceUpdateMessFailed"));
                    }
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },

            onChangeInvoiceStatus: function (oEventOrStatus) {

                var that = this;
                var status = "";
                if (oEventOrStatus && typeof oEventOrStatus.getSource === "function") {
                    var oSource = oEventOrStatus.getSource();

                    if (typeof oSource.getValue === "function") {
                        status = oSource.getValue();
                        this.visiablityPlay.setProperty("/Form", true);
                        this.visiablityPlay.setProperty("/Table", false);
                    }
                }
                else if (typeof oEventOrStatus === "string") {
                    status = oEventOrStatus;
                    this.visiablityPlay.setProperty("/Form", false);
                    this.visiablityPlay.setProperty("/Table", true);
                }
                if (status === "Payment Received" || status === "Payment Partially" || status === "Open") {
                    var oView = that.getView();
                    if (!that.oDialog) {
                        that.oDialog = sap.ui.core.Fragment.load({
                            name: "sap.kt.com.minihrsolution.fragment.CompanyInvoice",
                            controller: that
                        }).then(function (oDialog) {
                            that.oDialog = oDialog;
                            oView.addDependent(that.oDialog);

                            that.oDialog.open();

                            that.modelFunction();
                        }.bind(that));
                    } else {

                        that.oDialog.open();
                        that.modelFunction();
                    }
                }
            },

            modelFunction: function () {
                var oNavigationModel = this.getView().getModel("SelectedCustomerModel").getData();
                var ResivedTDSData = (
                    oNavigationModel.Currency === "INR"
                        ? parseFloat(oNavigationModel.IncomeTax) - parseFloat(this.getView().getModel("InvoicePayment").getProperty("/AllReceivedTDS") || 0) : 0).toFixed(2)
                var oModel = new JSONModel({
                    InvNo: oNavigationModel.InvNo,
                    TransactionId: "",
                    ReceivedDate: "",
                    ReceivedAmount: "",
                    TotalAmount: parseFloat(oNavigationModel.TotalAmount).toFixed(2),
                    DueAmount: (
                        this.getView().getModel("InvoicePayment").getData().length !== 0
                            ? parseFloat(this.getView().getModel("InvoicePayment").getProperty("/AllDueAmount")) //- parseFloat(ResivedTDSData || 0)
                            : parseFloat(oNavigationModel.TotalAmount || 0) //                  - parseFloat(oNavigationModel.IncomeTax || 0)
                    ).toFixed(2),
                    Currency: oNavigationModel.Currency,
                    ReceivedTDS: ResivedTDSData,
                    ConversionRate: "",
                    AmountInINR: "",
                    FlagVisCompany: "Expense Invoice"

                });

                this.getView().setModel(oModel, "PaymentModel")
                this.DueAmount = (this.getView().getModel("InvoicePayment").getData().length !== 0) ? parseFloat(this.getView().getModel("InvoicePayment").getProperty("/AllDueAmount")) : parseFloat(oNavigationModel.TotalAmount) //- parseFloat(oNavigationModel.IncomeTax);
                this.ResivedTDS = (oNavigationModel.Currency === "INR") ? parseFloat(oNavigationModel.IncomeTax) - parseFloat(this.getView().getModel("InvoicePayment").getProperty("/AllReceivedTDS") || 0) : '0';
            },

            CID_onPressDisplayPaymentDetail: function () {
                this.onChangeInvoiceStatus("Open");
                this.visiablityPlay.setProperty("/Form", false);
                this.visiablityPlay.setProperty("/Table", true);
            },

            onChangeReceivedAmount: function (oEvent) {
                var paymentModel = this.getView().getModel("PaymentModel");
                var allPaymentData = this.getView().getModel("InvoicePayment");

                var totalReceivedAmount = 0;
                if (allPaymentData) {
                    totalReceivedAmount = allPaymentData.getProperty("/AllReceivedAmount");
                }

                var sValue = paymentModel.getProperty("/ReceivedAmount") || "";
                sValue = sValue.replaceAll(',', '');
                paymentModel.setProperty("/ReceivedAmount", sValue);

                var totalAmount = parseFloat(paymentModel.getProperty("/TotalAmount")) || 0;
                var receivedAmount = parseFloat(sValue) || 0;
                var receivedTDS = parseFloat((paymentModel.getProperty("/ReceivedTDS") || "").replaceAll(',', '')) || 0;
                var AllreceivedTDS = parseFloat(allPaymentData.getProperty("/AllReceivedTDS")) || 0;

                var dueAmount = totalAmount - totalReceivedAmount - receivedAmount;
                paymentModel.setProperty("/DueAmount", dueAmount.toFixed(2));
                this.onChangePaymentConvertionRate();

                if (oEvent) {
                    var enteredAmount = parseFloat(oEvent.getParameter("value").replaceAll(',', '')) || 0;
                    var dueAmount = parseFloat(this.DueAmount);
                    this.ResivedAmount = true;
                    if (enteredAmount === dueAmount) {
                        sap.ui.getCore().byId("idReceivedAmount").setValueState("None");
                    } else if (enteredAmount > dueAmount) {
                        this.ResivedAmount = false;
                        sap.ui.getCore().byId("idReceivedAmount").setValueState("Error");
                        sap.ui.getCore().byId("idReceivedAmount").setValueStateText(this.i18nModel.getText("invoiceRecievedAmountMessage"));
                    } else {
                        sap.ui.getCore().byId("idReceivedAmount").setValueState("None");
                        this.ResivedAmount = true;
                        utils._LCvalidateAmountZeroTaking(oEvent);
                    }
                }
            },

            onChangePaymentConvertionRate: function (oEvent) {
                if (oEvent) utils._LCvalidateAmount(oEvent);
                var oModelData = this.getView().getModel("PaymentModel");
                var receivedAmount = parseFloat(oModelData.getData().ReceivedAmount);
                var conversionRate = parseFloat(oModelData.getData().ConversionRate);
                var AmountInINR = receivedAmount * conversionRate;
                (isNaN(AmountInINR)) ? oModelData.setProperty("/AmountInINR", '0.00') : oModelData.setProperty("/AmountInINR", AmountInINR.toFixed(2));
            },

            onChangeReceivedTDS: async function (oEvent) {
                var oInput = sap.ui.getCore().byId("idReceivedTDS");
                var sValue = oInput.getValue().replaceAll(',', ''); // Remove comma
                oInput.setValue(sValue);  // Update cleaned value back to Input

                if (parseFloat(sValue) > parseFloat(this.ResivedTDS)) {
                    this.ResivedTDSFlag = false;
                    oInput.setValueState("Error");
                    oInput.setValueStateText(this.i18nModel.getText("tdsAmountError"));
                } else {
                    this.ResivedTDSFlag = true;
                    oInput.setValueState("None");
                    this.onChangeReceivedAmount();
                }
            },

            Readcall: async function (entity, filterValue) {
                const oData = await this.ajaxReadWithJQuery(entity, filterValue);
                if (entity === "ExpenseInvoice") {//CompanyInvoice
                    const invoiceData = oData.data?.[0] || {};
                    if (invoiceData.Currency !== "INR") {
                        invoiceData.AmountInFCurrency = invoiceData.AmountInINR;
                    }
                    invoiceData.InvoiceDate = this.Formatter.formatDate(invoiceData.InvoiceDate);
                    invoiceData.PayByDate = this.Formatter.formatDate(invoiceData.PayByDate);
                    this.getView().setModel(new JSONModel(invoiceData), "SelectedCustomerModel");
                    this.Status = invoiceData.Status;
                    return;
                }
                // Handle non-"CompanyInvoice" case
                const view = this.getView();
                view.setModel(new JSONModel(oData.data), "InvoicePayment");
                view.setModel(new JSONModel({ InvoicePaymentDetail: oData.data }), "PaymentDetailModel");
                const items = oData.data || [];
                const totalReceivedAmount = items.reduce((sum, item) => sum + (parseFloat(item.ReceivedAmount) || 0), 0);
                const totalReceivedTDS = items.reduce((sum, item) => sum + (parseFloat(item.ReceivedTDS) || 0), 0);
                const totalAmount = parseFloat(items[0]?.TotalAmount || 0);
                const totalDueAmount = totalAmount - (totalReceivedAmount);
                const invoiceModel = view.getModel("InvoicePayment");
                invoiceModel.setProperty("/AllReceivedAmount", totalReceivedAmount.toFixed(2));
                invoiceModel.setProperty("/AllReceivedTDS", totalReceivedTDS.toFixed(2));
                invoiceModel.setProperty("/AllDueAmount", totalDueAmount.toFixed(2));
                invoiceModel.setProperty("/AllReceiveTDS", totalReceivedTDS.toFixed(2));
                invoiceModel.refresh(true);
            },

            onPressInvClose: function () {
                sap.ui.getCore().byId("idTransactionID").setValueState("None");
                sap.ui.getCore().byId("idReceivedAmount").setValueState("None");
                sap.ui.getCore().byId("idReceivedTDS").setValueState("None");
                sap.ui.getCore().byId("idFrgConvertionRate").setValueState("None");

                if (this.oDialog) {
                    this.oDialog.close();
                    this.oDialog.destroy(true);
                    this.oDialog = null;
                }
            },
            onLiveTransactionID: function (oEvent) { utils._LCvalidateMandatoryField(oEvent) },
            onReceivedDateDatePickerChange: function (oEvent) { utils._LCvalidateDate(oEvent); },
            onChangePaymentRecived: async function () {
                var paymentModel = this.getView().getModel("PaymentModel").getData();
                const isMandatoryValid =
                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId("idTransactionID"), "ID") &&
                    utils._LCvalidateDate(sap.ui.getCore().byId("idReceivedDate"), "ID");

                let isCurrencyValid = true;
                if (paymentModel.Currency !== "INR") {
                    isCurrencyValid = utils._LCvalidateAmount(sap.ui.getCore().byId("idFrgConvertionRate"), "ID");
                } else {
                    await this.onChangeReceivedTDS();
                }

                var receivedAmount = parseFloat((paymentModel.ReceivedAmount || "0").replaceAll(',', ''));
                var receivedTDS = parseFloat((paymentModel.ReceivedTDS).replaceAll(',', ''));
                var isReceivedAmountInvalid = isNaN(receivedAmount) || receivedAmount <= 0;
                // var isReceivedTDSInvalid = isNaN(receivedTDS) || receivedTDS <= 0;

                if (isReceivedAmountInvalid) {
                    sap.ui.getCore().byId("idReceivedAmount").setValueState("Error").setValueStateText(this.i18nModel.getText("invoiceRecievedAmountMessage"));
                } else {
                    sap.ui.getCore().byId("idReceivedAmount").setValueState("None");
                }

                // if (isReceivedTDSInvalid) {
                //     sap.ui.getCore().byId("idReceivedTDS").setValueState("Error").setValueStateText(this.i18nModel.getText("tdsAmountError"));
                // } else {
                //     sap.ui.getCore().byId("idReceivedTDS").setValueState("None");
                // }

                if (isReceivedAmountInvalid) {
                    MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    return;
                }

                const isValid = isMandatoryValid && isCurrencyValid && this.ResivedAmount && this.ResivedTDSFlag;
                if (!this.ResivedAmount) {
                    sap.ui.getCore().byId("idReceivedAmount").setValueState("Error").setValueStateText(this.i18nModel.getText("invoiceRecievedAmountMessage"));
                }

                if (!isValid) {
                    MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    return;
                }

                if (Number(paymentModel.DueAmount) < 0) {
                    sap.m.MessageBox.error(this.i18nModel.getText("dueAmountZeroOrNegative"));
                    return;
                }

                this.getBusyDialog();
                const jsonData = {
                    InvNo: String(paymentModel.InvNo),
                    TransactionId: String(paymentModel.TransactionId),
                    ReceivedDate: String(paymentModel.ReceivedDate),
                    ReceivedAmount: String(paymentModel.ReceivedAmount),
                    TotalAmount: String(paymentModel.TotalAmount),
                    DueAmount: String(paymentModel.DueAmount),
                    Currency: String(paymentModel.Currency),
                    // ReceivedTDS: String(paymentModel.ReceivedTDS),
                    ConversionRate: paymentModel.Currency !== "INR" ? String(paymentModel.ConversionRate) : "",
                    AmountInINR: paymentModel.Currency !== "INR" ? String(paymentModel.AmountInINR) : ""
                };

                try {
                    const oData = await this.ajaxCreateWithJQuery("ExpenseInvoicePaymentDetail", { data: jsonData });

                    if (oData && oData.success) {
                        this.oDialog.close();
                        this.Readcall("ExpenseInvoicePaymentDetail", { InvNo: this.decodedPath });
                        this.Readcall("ExpenseInvoice", { InvNo: this.decodedPath });//CompanyInvoice

                        const hasDue = parseFloat(paymentModel.DueAmount) > 0;
                        this.visiablityPlay.setProperty("/payByDate", hasDue ? this.ReminderEmail : false);
                        this.visiablityPlay.setProperty("/MultiEmail", hasDue);
                        this.visiablityPlay.setProperty("/Edit", hasDue);
                        this.visiablityPlay.setProperty("/editable", false);
                        this.visiablityPlay.setProperty("/CInvoice", false);
                        this.visiablityPlay.setProperty("/merge", true);
                        this.visiablityPlay.setProperty("/addInvBtn", false);
                        this.byId("EID_id_TableInvoiceItem").setMode("None");
                        MessageToast.show(this.i18nModel.getText("paymentMessage"));
                    }
                } catch (error) {
                    MessageToast.show(error.responseText);
                } finally {
                    this.closeBusyDialog();
                }
            },

            CID_ValidateCommonFields: function (oEvent) { utils._LCvalidateMandatoryField(oEvent); },

            CID_CurrencyChanges: function (oEvent) {
                if (oEvent.getSource().getValue() !== "INR") {
                    this.byId("EIdSAC").setVisible(false);
                    this.byId("EIdGSTCalculation").setVisible(false);
                    this.visiablityPlay.setProperty("/TDS", false);
                } else {
                    this.byId("EIdSAC").setVisible(true);
                    this.byId("EIdGSTCalculation").setVisible(true);
                    this.visiablityPlay.setProperty("/TDS", true);
                }
                this.visiablityPlay.refresh(true);
                this.totalAmountCalculation();
            },
            CD_onDiscountInfoPress: function (oEvent) {
                if (!this._oPopover) {
                    this._oPopover = new sap.m.Popover({
                        contentWidth: "400px",
                        contentHeight: "auto",
                        showHeader: false,
                        placement: sap.m.PlacementType.Bottom,
                        content: [
                            new sap.m.VBox({
                                alignItems: "Center",
                                justifyContent: "Center",
                                width: "100%",
                                items: [
                                    new sap.m.Text({
                                        text: this.i18nModel.getText("discountInfoText"),
                                        wrapping: true
                                    })
                                ]
                            }).addStyleClass("customPopoverContent")
                        ]
                    });
                    this.getView().addDependent(this._oPopover);
                }
                this._oPopover.openBy(oEvent.getSource());
            },

            CID_onPressDelete: function (oEvent) {
                var that = this;
                var oModel = this.getView().getModel("ExpenseInvoiceItemModel");
                var oContext = oEvent.getParameter("listItem").getBindingContext("ExpenseInvoiceItemModel");
                var sIndex = oContext.getPath().split("/")[2];

                var aData = oModel.getData();

                if (oContext.getObject().ItemID) {
                    this.showConfirmationDialog(
                        this.i18nModel.getText("msgBoxConfirm"),
                        this.i18nModel.getText("msgBoxConfirmDelete"),
                        function () {
                            that.getBusyDialog();
                            that.ajaxDeleteWithJQuery("/ExpenseInvoiceItem", {
                                filters: { ItemID: oContext.getObject().ItemID }
                            }).then(() => {
                                aData.ExpenseInvoiceItem.splice(oContext.getPath().split('/')[2], 1);
                                aData.ExpenseInvoiceItem.forEach((item, index) => item.IndexNo = index + 1);
                                oModel.setProperty("/ExpenseInvoiceItem", aData.ExpenseInvoiceItem);
                                that.SNoValue = aData.ExpenseInvoiceItem.length;
                                that.totalAmountCalculation();
                                MessageToast.show(that.i18nModel.getText("CompanyInvoiceDeleteSuccess"));
                                that.closeBusyDialog();
                            }).catch((error) => {
                                that.closeBusyDialog();
                                MessageToast.show(error.responseText);
                            });
                        },
                        function () { that.closeBusyDialog(); }
                    );
                } else {
                    // Local item – delete directly
                    aData.ExpenseInvoiceItem.splice(sIndex, 1);
                    aData.ExpenseInvoiceItem.forEach((item, index) => item.IndexNo = index + 1);
                    oModel.setProperty("/ExpenseInvoiceItem", aData.ExpenseInvoiceItem);
                    this.SNoValue = aData.ExpenseInvoiceItem.length;
                    this.totalAmountCalculation();
                }
            },

            CID_onPressSendEmail: function (oEvent) {
                var that = this;
                that.loginModel.setProperty("/RichText", true);
                that.loginModel.setProperty("/SimpleForm", false);
                var modelData = that.getView().getModel("SelectedCustomerModel").getData();

                var oUploaderDataModel = new JSONModel({
                    isEmailValid: true,
                    ToEmail: modelData.MailID,
                    ToName: modelData.CustomerName,
                    CCEmail: this.getView().getModel("CCMailModel").getData()[0].CCEmailId,
                    name: "",
                    mimeType: "",
                    content: "",
                    isFileUploaded: false,
                    button: true,
                    Subject: "KALPAVRIKSHA TECHNOLOGIES - INVOICE PAYMENT REMAINDER",
                    htmlbody: `<p>Dear Finance Team,</p>
                    <p>I hope you're doing well. This is a friendly remainder that payment for invoice ${modelData.InvNo}, issued on  ${modelData.InvoiceDate}, is still outstanding.</p>
                    <li><b>Invoice No : ${modelData.InvNo}</b></li>
                    <li><b>Due Date : ${modelData.PayByDate}</b></li>
                    <li><b>Invoice Amount : ${this.Formatter.fromatNumber(modelData.TotalAmount)} ${modelData.Currency}</b></li>
                    <li><b>Received Amount : ${this.Formatter.fromatNumber(this.getView().getModel("InvoicePayment").getProperty("/AllReceivedAmount"))} ${modelData.Currency}</b></li>                   
                    <li><b>Due Amount : ${this.Formatter.fromatNumber(
                        this.getView().getModel("InvoicePayment").getProperty("/AllDueAmount")) === '0.00'
                            ? this.Formatter.fromatNumber(modelData.TotalAmount)
                            : this.Formatter.fromatNumber(this.getView().getModel("InvoicePayment").getProperty("/AllDueAmount"))
                        } ${modelData.Currency}</b></li>                         
                    <li><b>Description : ${modelData.InvoiceDescription}</b></li>

                    <p>If you’ve already made the payment, kindly disregard this remainder. Otherwise, we would appreciate it if you could arrange payment as soon as possible.</p>
                    <p>If you have any questions or need further information, please don't hesitate to contact us.</p>
                    <p>Thank you for your attention to this matter.</p>
                   <p style="margin: 0;">Best Regards,</p>                   
                   <p style="margin: 0;">Finance Department</p>
                    `
                });
                this.getView().setModel(oUploaderDataModel, "UploaderData");
                this.EOD_commonOpenDialog("sap.kt.com.minihrsolution.fragment.CommonMail", true);
            },

            CID_onPressSendMultipalEmail: function () {
                var that = this;
                that.loginModel.setProperty("/RichText", true);
                that.loginModel.setProperty("/SimpleForm", true);
                var modelData = that.getView().getModel("SelectedCustomerModel").getData();
                // that.getView().getModel("TextDisplay").setProperty("/name", "");
                var EmailData = that.getView().getModel("SelectedCustomerModel");

                var oUploaderDataModel = new JSONModel({
                    isEmailValid: true,
                    ToEmail: modelData.MailID,
                    ToName: modelData.CustomerName,
                    CCEmail: this.getView().getModel("CCMailModel").getData()[0].CCEmailId,
                    name: "",
                    mimeType: "",
                    content: "",
                    isFileUploaded: false,
                    button: false,
                    Subject: `${modelData.CustomerName} - ${modelData.InvoiceDescription}`,
                    htmlbody: `<p>Dear Finance Team,</p>
                    <p>Please find the following invoice detail below:</p>
                    <li><b>Invoice No : ${modelData.InvNo}</b></li>
                    <li><b>Invoice Date : ${modelData.InvoiceDate}</b></li>
                    <li><b>Total Amount : ${this.Formatter.fromatNumber(modelData.TotalAmount)} ${modelData.Currency}</b></li>
                    <li><b>Description : ${modelData.InvoiceDescription}</b></li>

                    <p>If you have any questions or require further information, please do not hesitate to contact us.</p>
                   <p style="margin: 0;">Best Regards,</p>
                   <p style="margin: 0;">Nikhil Shah,</p>
                   <p style="margin: 0;">Accountant Manager</p>
                   `
                });
                this.getView().setModel(oUploaderDataModel, "UploaderData");
                this.EOD_commonOpenDialog("sap.kt.com.minihrsolution.fragment.CommonMail", false);
                this.validateSendButton();
            },

            Mail_onPressClose: function () {
                this.loginModel.setProperty("/RichText", false);
                this.loginModel.setProperty("/SimpleForm", true);
                this.EOU_oDialogMail.close();
                this.EOU_oDialogMail.destroy(true);
                this.EOU_oDialogMail = null
            },

            EOD_commonOpenDialog: async function (fragmentName, value) {
                if (!this.EOU_oDialogMail) {
                    sap.ui.core.Fragment.load({
                        name: fragmentName,
                        controller: this,
                    }).then(function (EOU_oDialogMail) {
                        this.EOU_oDialogMail = EOU_oDialogMail;
                        this.getView().addDependent(this.EOU_oDialogMail);
                        this.EOU_oDialogMail.open();
                        if (value === true) sap.ui.getCore().byId("SendMail_Button").setEnabled(true);
                    }.bind(this));
                } else {
                    this.EOU_oDialogMail.open();
                    if (value === true) sap.ui.getCore().byId("SendMail_Button").setEnabled(true);
                }
            },

            Mail_onUpload: function (oEvent) {
                this.handleFileUpload(
                    oEvent,
                    this,                      // context
                    "UploaderData",            // model name
                    "/attachments",            // path to attachment array
                    "/name",                   // path to comma-separated file names
                    "/isFileUploaded",         // boolean flag path
                    "uploadSuccessfull",       // i18n success key
                    "fileAlreadyUploaded",     // i18n duplicate key
                    "noFileSelected",          // i18n no file selected
                    "fileReadError",           // i18n file read error
                    () => this.validateSendButton()
                );
            },
            //Mail dialog button visibility
            validateSendButton: function () {
                try {
                    const sendBtn = sap.ui.getCore().byId("SendMail_Button");
                    const emailField = sap.ui.getCore().byId("CCMail_TextArea");
                    const emailFieldTo = sap.ui.getCore().byId("Mail_id_Text");
                    const uploaderModel = this.getView().getModel("UploaderData");
                    if (!sendBtn || !emailField || !uploaderModel || !emailFieldTo) {
                        return;
                    }
                    const isEmailValid = utils._LCvalidateEmail(emailField, "ID") === true;
                    const isEmailValidTo = utils._LCvalidateEmail(emailFieldTo, "ID") === true;
                    const isFileUploaded = uploaderModel.getProperty("/isFileUploaded") === true;
                    sendBtn.setEnabled(isEmailValid && isEmailValidTo && isFileUploaded);
                } catch (error) {
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },

            Mail_onEmailChange: function () {
                this.validateSendButton();
            },
            //Send mail
            Mail_onSendEmail: function () {
                try {
                    var oModel = this.getView().getModel("UploaderData").getData();
                    if (this.loginModel.getProperty("/SimpleForm")) {
                        if (!oModel.attachments || oModel.attachments.length === 0) {
                            MessageToast.show(this.i18nModel.getText("attachmentRequired")); // Or a hardcoded string: "Please add at least one attachment."
                            return;
                        }
                    }
                    var SelectedModel = this.getView().getModel("SelectedCustomerModel");
                    var oPayload = {
                        "InvNo": SelectedModel.getData().InvNo,
                        "toEmailID": oModel.ToEmail,
                        "toName": oModel.ToName,
                        "subject": oModel.Subject,
                        "body": oModel.htmlbody,
                        "CCEmailId": oModel.CCEmail,
                        "attachments": oModel.attachments
                    };
                    this.getBusyDialog();
                    this.ajaxCreateWithJQuery("CompanyInvoiceEmail", oPayload).then((oData) => {
                        MessageToast.show(this.i18nModel.getText("emailSuccess"));
                        this.closeBusyDialog();
                        SelectedModel.setProperty("/Status", "Invoice Sent");
                        SelectedModel.refresh(true);
                        this.loginModel.setProperty("/RichText", false);
                        this.loginModel.setProperty("/SimpleForm", true);
                    }).catch((error) => {
                        this.closeBusyDialog();
                        MessageToast.show(error.responseText);
                    });
                    this.Mail_onPressClose();
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(error.responseText);
                }
            },

            onIncomeTaxPercentageInputLiveChange: function (oEvent) {
                utils._LCvalidateVariablePay(oEvent);
                const oNavigationModel = this.getView().getModel("SelectedCustomerModel");
                const oNavigationData = oNavigationModel.getData();

                if (oNavigationData.Currency === "INR") {
                    const subTotalInGST = parseFloat(oNavigationData.SubTotalInGST) || 0;
                    const subTotalNotGST = parseFloat(oNavigationData.SubTotalNotGST) || 0;
                    const incomePerc = parseFloat(oNavigationData.IncomePerc) || 0;

                    const total = subTotalInGST + subTotalNotGST;
                    const tds = ((total * incomePerc) / 100).toFixed(2);
                    oNavigationModel.setProperty("/IncomeTax", Math.round(tds));
                }
            },

            CID_onPressGeneratePdf: async function () {
                const { jsPDF } = window.jspdf;
                var that = this
                const oView = this.getView();
                const oModel = oView.getModel("SelectedCustomerModel").getData();
                var data = this.getView().getModel("FilteredSOWModel").getData();
                const oExpenseInvoiceItemModel = oView.getModel("ExpenseInvoiceItemModel").getData();
                const oCompanyItemModel = oExpenseInvoiceItemModel.ExpenseInvoiceItem || [];
                let filter = {
                    companyCode: oModel.CompanyCode
                }
                try {
                    const oCompanyDetailsModel = await that.ajaxReadWithJQuery("CompanyCodeDetails", filter);
                    const imgblob = new Blob([new Uint8Array(oCompanyDetailsModel.data[0].transparentComplogo?.data)], { type: "image/png" });
                    const signBlob = new Blob([new Uint8Array(oCompanyDetailsModel.data[0].signature?.data)], { type: "image/png" });

                    // const imgblob = new Blob([new Uint8Array(oCompanyDetailsModel.companylogo?.data)], { type: "image/png" });
                    // const signBlob = new Blob([new Uint8Array(oCompanyDetailsModel.signature?.data)], { type: "image/png" });
                    const img = await this._convertBLOBToImage(imgblob);
                    const signature = await this._convertBLOBToImage(signBlob);

                    let totalInWords = await this.convertNumberToWords(oModel.TotalAmount, data.Currency);
                    const showSAC = oModel.GST !== undefined && oModel.GST !== "";

                    const margin = 15;
                    const doc = new jsPDF({
                        orientation: "portrait",
                        unit: "mm",
                        format: "a4"
                    });

                    const pageWidth = doc.internal.pageSize.getWidth();
                    const pageHeight = doc.internal.pageSize.getHeight();
                    const usableWidth = pageWidth - 2 * margin;
                    const footerHeight = 18;
                    let currentY = 0;

                    const checkPageSpace = (requiredSpace = 40) => {
                        if (currentY + requiredSpace > pageHeight - footerHeight) {
                            doc.addPage();
                            currentY = 20;
                        }
                    };

                    const headerMargin = 25.4;
                    doc.setFontSize(14).setFont("times", "bold");
                    doc.text("INVOICE", pageWidth - 18, headerMargin, { align: "right" });
                    doc.addImage(img, 'PNG', margin, 15, 40, 40);

                    const detailsStartY = 35;
                    const rowHeight = 6.5;
                    const columnWidths = [30, 30];
                    const rightAlignX = pageWidth - 18 - columnWidths[0] - columnWidths[1];
                    doc.setFontSize(12).setFont("times", "bold");

                    const detailsTable = [
                        { label: 'Invoice No. :', value: oModel.InvNo },
                        { label: 'Date :', value: typeof (oModel.InvoiceDate) === 'string' ? oModel.InvoiceDate : Formatter.formatDate(oModel.InvoiceDate) },
                        { label: 'PO/SOW :', value: oModel.POSOW.toString() },
                    ];

                    currentY = detailsStartY;

                    detailsTable.forEach(row => {
                        doc.setFont("times", "bold");
                        doc.text(row.label, rightAlignX + columnWidths[0] - doc.getTextWidth(row.label), currentY + 5);
                        doc.setFont("times", "bold");
                        doc.text(row.value, rightAlignX + columnWidths[0] + 5, currentY + 5);
                        currentY += rowHeight;
                    });

                    currentY += 15;
                    doc.setFont("times", "bold").setFontSize(11);
                    doc.text("To,", margin, currentY);
                    currentY += 5;

                    doc.setFont("times", "normal").setFontSize(11);
                    const maxLength = 30;
                    const customerName = oModel.CustomerName || "";
                    const lines = [];

                    for (let i = 0; i < customerName.length; i += maxLength) {
                        lines.push(customerName.substring(i, i + maxLength));
                    }

                    lines.forEach(line => {
                        doc.text(line, margin, currentY);
                        currentY += 5;
                    });


                    const customerAddressLines = doc.splitTextToSize(oModel.Address, usableWidth / 2 - 10);
                    doc.text(customerAddressLines, margin, currentY);
                    currentY += customerAddressLines.length * 5;

                    if (oModel.GST !== undefined && oModel.GST !== "") {
                        doc.text(`GSTIN : ${oModel.GST}`, margin, currentY);
                        currentY += 5;
                    }

                    currentY += 5;

                    const body = oCompanyItemModel.map((item, index) => {
                        const row = [
                            index + 1,
                            item.Particulars,
                            item.Unit || "-",
                            Formatter.fromatNumber(item.Rate) || '0.00',
                            // Formatter.fromatNumber(item.Discount) || '0.00',
                            Formatter.fromatNumber(item.Total) || '0.00'
                        ];
                        if (showSAC) row.splice(2, 0, item.SAC);
                        return row;
                    });

                    const head = showSAC
                        ? [['Sl.No.', 'Particulars', 'SAC', 'Unit', 'Rate', 'Discount', 'Total']]
                        : [['Sl.No.', 'Particulars', 'Unit', 'Rate', 'Total']];

                    doc.autoTable({
                        startY: currentY,
                        head: head,
                        body: body,
                        theme: 'grid',
                        headStyles: { fillColor: [41, 128, 185] },
                        styles: {
                            font: "times", fontSize: 10, cellPadding: 3, lineWidth: 0.5, lineColor: [30, 30, 30],
                            halign: "center"
                        },
                        columnStyles: {
                            0: { halign: 'center' },
                            1: { halign: 'left' },
                            ...(showSAC ? {
                                2: { halign: 'center' },
                                3: { halign: 'right' },
                                4: { halign: 'right' },
                                5: { halign: 'right' },
                                6: { halign: 'right' }
                            } : {
                                2: { halign: 'center' },
                                3: { halign: 'right' },
                                4: { halign: 'right' },
                                5: { halign: 'right' }
                            })
                        },
                    });

                    currentY = doc.lastAutoTable.finalY;
                    checkPageSpace(50);

                    const summaryBody = [];

                    if (parseFloat(oModel.SubTotalInGST) > 0) {
                        summaryBody.push([`Sub-Total ( Non-Taxable ) (${data.Currency}) :`,
                        Formatter.fromatNumber(parseFloat(oModel.SubTotalInGST))
                        ]);
                    }

                    if (data.RoundOf && data.RoundOf !== "0") {
                        summaryBody.push([`Round Off (${data.Currency}) :`, data.RoundOf]);
                    }

                    const totalRowIndex = summaryBody.length;
                    summaryBody.push([`Total (${data.Currency}) :`, Formatter.fromatNumber(parseFloat(oModel.TotalAmount))]);

                    doc.autoTable({
                        startY: currentY,
                        head: [],
                        body: summaryBody,
                        theme: 'plain',
                        styles: {
                            font: "times",
                            fontSize: 10,
                            halign: "right",
                            cellPadding: 2,
                            overflow: "ellipsize"
                        },
                        columnStyles: {
                            0: { halign: "right", cellWidth: 60 },
                            1: { halign: "right", cellWidth: 40 }
                        },
                        margin: { left: 95 },
                        didParseCell: function (data) {
                            if (data.row.index === totalRowIndex) {
                                data.cell.styles.lineWidth = { top: 0.5, right: 0, bottom: 0, left: 0 };
                                data.cell.styles.lineColor = [0, 0, 0];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    });

                    currentY = doc.lastAutoTable.finalY + 10;
                    checkPageSpace(25);

                    oModel.AmountInWords = totalInWords;
                    doc.setFont("times", "bold");
                    doc.text("Amount in Words:", 13, currentY);
                    currentY += 5;
                    doc.setFont("times", "normal");
                    const amountHeight = doc.getTextDimensions(oModel.AmountInWords || "").h;
                    doc.text(oModel.AmountInWords || "", 13, currentY, { maxWidth: 180 });
                    currentY += amountHeight + 10;

                    checkPageSpace(40);
                    doc.setFont("times", "bold").setFontSize(11);
                    doc.text("PAYMENT METHOD :", margin - 2, currentY);
                    currentY += 5;

                    const paymentDetails = [
                        { label: "Bank Name", value: oCompanyDetailsModel.data[0].bankName },
                        { label: "Account Name", value: oCompanyDetailsModel.data[0].accountName },
                        { label: "Account No", value: oCompanyDetailsModel.data[0].accountNo },
                        { label: "IFSC Code", value: oCompanyDetailsModel.data[0].ifscCode },
                        { label: "Swift Code", value: oCompanyDetailsModel.data[0].swiftCode },
                        { label: 'Pay By', value: typeof (oModel.InvoiceDate) === 'string' ? oModel.PayByDate : Formatter.formatDate(oModel.PayByDate) },
                    ];
                    paymentDetails.forEach(detail => {
                        doc.setFont("times", "bold");
                        const label = `${detail.label} :`;
                        const labelWidth = doc.getTextWidth(label);
                        doc.text(label, margin - 2, currentY);
                        doc.setFont("times", "normal");
                        doc.text(detail.value, margin + labelWidth, currentY);
                        currentY += 5;
                    });

                    checkPageSpace(35);
                    const rightEdgeX = pageWidth - margin;
                    const lineSpacing = 5;
                    const maxLineLength = 45;
                    const forText = "For: " + oCompanyDetailsModel.data[0].companyName;

                    // Split text if more than 45 characters
                    let forTextLines = [];
                    if (forText.length > maxLineLength) {
                        const words = forText.split(" ");
                        let currentLine = "";
                        for (const word of words) {
                            if ((currentLine + " " + word).trim().length <= maxLineLength) {
                                currentLine += " " + word;
                            } else {
                                forTextLines.push(currentLine.trim());
                                currentLine = word;
                            }
                        }
                        if (currentLine) {
                            forTextLines.push(currentLine.trim());
                        }
                    } else {
                        forTextLines = [forText];
                    }

                    // Draw wrapped "For: Company Name" right-aligned
                    doc.setFont("helvetica", "bold").setFontSize(11);
                    let forLabelY = currentY;
                    for (let i = 0; i < forTextLines.length; i++) {
                        const line = forTextLines[i];
                        const lineWidth = doc.getTextWidth(line);
                        doc.text(line, rightEdgeX - lineWidth, forLabelY);
                        const isLastLine = i === forTextLines.length - 1;
                        const isWrapped = forText.length > maxLineLength;

                        if (!isLastLine || isWrapped) {
                            forLabelY += lineSpacing;
                        }
                    }

                    // Signature (Right-aligned under company name)
                    const signatureWidth = 57;
                    const signatureHeight = 13;
                    const logoXPosition = rightEdgeX - signatureWidth + 16; // align to rightEdge
                    const logoYPosition = forLabelY + 2;

                    doc.addImage(signature, 'JPEG', logoXPosition, logoYPosition, signatureWidth, signatureHeight);

                    // Head of Company (Right-aligned)
                    const headName = oCompanyDetailsModel.data[0].headOfCompany || "";
                    const headWidth = doc.getTextWidth(headName);
                    const partnersYPosition = logoYPosition + signatureHeight + 2;

                    doc.setFont("helvetica", "bold").setFontSize(11);
                    doc.text(headName, rightEdgeX - headWidth, partnersYPosition);

                    // Designation (Right-aligned)
                    const designation = oCompanyDetailsModel.data[0].designation || "";
                    const designationWidth = doc.getTextWidth(designation);
                    doc.text(designation, rightEdgeX - designationWidth, partnersYPosition + lineSpacing);

                    doc.setFont("times", "normal").setFontSize(11);
                    doc.text("Thank you for your business!", margin - 2, partnersYPosition + 10);

                    const totalPages = doc.internal.getNumberOfPages();
                    for (let i = 1; i <= totalPages; i++) {
                        doc.setPage(i);
                        this.addFooter(doc, oCompanyDetailsModel, pageWidth, pageHeight, i, totalPages);
                    }

                    doc.save(`${oModel.CustomerName}-${oModel.InvNo}-Invoice.pdf`);
                } catch (error) {
                    that.closeBusyDialog();
                    MessageToast.show(error.message || error.responseText);
                }
            },

            addFooter: function (doc, oCompanyDetailsModel, pageWidth, pageHeight, currentPage, totalPages) {
                const compFooterAddress = oCompanyDetailsModel.longAddress || "";
                const CompGSTIN = oCompanyDetailsModel.gstin || "";
                const CompLUTNo = oCompanyDetailsModel.lutno || "";
                const CompMobileNo = oCompanyDetailsModel.mobileNo || "";
                const CompJURISDICTION = oCompanyDetailsModel.city || "";

                const footerHeight = 18;
                const footerYPosition = pageHeight - footerHeight;
                const footerWidth = pageWidth;

                doc.setFillColor(128, 128, 128);
                doc.rect(0, footerYPosition, footerWidth, footerHeight, 'F'); // Grey footer background

                doc.setFont("helvetica", "normal").setFontSize(8);
                doc.setTextColor(255, 255, 255); // White text

                const textYPosition = footerYPosition + 5;
                const lineHeight = 5;

                doc.setFontSize(8);
                doc.text(`SUBJECT TO ${oCompanyDetailsModel.data[0].city.toUpperCase()} JURISDICTION`, footerWidth / 2, textYPosition, { align: 'center' });
                doc.setFontSize(10);
                const addressLines = doc.splitTextToSize(oCompanyDetailsModel.data[0].longAddress, footerWidth - 100);
                let currentYPosition = textYPosition + 5;

                doc.setFontSize(10);
                doc.text(` GSTIN : ${oCompanyDetailsModel.data[0].gstin}`, footerWidth - 5, currentYPosition, { align: 'right' });
                doc.text(` Mobile No : ${oCompanyDetailsModel.data[0].mobileNo}`, footerWidth / 2 - 44, currentYPosition + 5, { align: 'center' });
                doc.text(`LUT No : ${oCompanyDetailsModel.data[0].lutno}`, footerWidth - 5, currentYPosition + 5, { align: 'right' });

                addressLines.forEach((line) => {
                    doc.text(line, 5, currentYPosition);
                    currentYPosition += lineHeight;
                });
            },
            //  EID_validateCombobox: function (oEvent) {
            //     utils._LCstrictValidationComboBox(oEvent, "oEvent");
            // },
        });
    });