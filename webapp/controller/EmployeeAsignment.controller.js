sap.ui.define(
    [
        "./BaseController",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageToast",
        "sap/m/MessageBox", //Import MessageBox for alerts/confirmations
        "../utils/validation",
        "../model/formatter",
        'sap/ui/export/Spreadsheet',
    ],
    function (BaseController, JSONModel, MessageToast, MessageBox, utils, Formatter, Spreadsheet) {
        "use strict";
        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.EmployeeAsignment", {
            Formatter: Formatter,
            onInit: function () {
                this.getRouter().getRoute("RouteEmployeeAssignment").attachMatched(this._onRouteMatched, this);
            },


            _onRouteMatched: async function () {
                var LoginFunction = await this.commonLoginFunction("ManageAssignment");
                if (!LoginFunction) return;
                this.getBusyDialog();
                var oLoginModel = this.getView().getModel("LoginModel");
                var sEmployeeID = oLoginModel.getProperty("/EmployeeID");

                this.getView().getModel("EmpDetails")
                var oToday = new Date();
                var sFormatted = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "MM/dd/yyyy"
                }).format(oToday);

                this.byId("EA_id_AssignDate").setValue(sFormatted);


                var oResponse = await this.ajaxReadWithJQuery("AssignedTaskDetails");

                if (oResponse && oResponse.success) {
                    this.closeBusyDialog();

                    var aData = oResponse.data;

                    //  Today's date
                    var oToday = new Date();
                    oToday.setHours(0, 0, 0, 0);

                    //  Filter ONLY by EndDate
                    var aFilteredData = aData.filter(function (item) {
                        if (!item.TaskEndDate) return false;

                        var oEnd = new Date(item.TaskEndDate);
                        oEnd.setHours(0, 0, 0, 0);

                        return oToday <= oEnd;
                    });

                    var oModel = new JSONModel(aFilteredData);
                    this.getView().setModel(oModel, "AssignmentModel");
                }


                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                this.getView().getModel("LoginModel").setProperty("/HeaderName", "Employee Assignment");
            },
            EA_onSearch: async function () {
                var oView = this.getView();

                try {
                    var sSelectedEmployee = oView.byId("EA_id_Employee").getSelectedKey();

                    var oDateRange = oView.byId("EA_id_StartDate");
                    var dFrom = oDateRange?.getDateValue();
                    var dTo = oDateRange?.getSecondDateValue();

                    var oSingleDate = oView.byId("EA_id_AssignDate");
                    var dToday = oSingleDate?.getDateValue();

                    var oPayload = {
                        EmployeeID: sSelectedEmployee || ""
                    };

                    //  CASE 1: Single DatePicker selected
                    if (dToday) {
                        var sToday = sap.ui.core.format.DateFormat.getDateInstance({
                            pattern: "yyyy-MM-dd"
                        }).format(dToday);

                        oPayload.TodayDate = sToday;
                    }

                    //  CASE 2: Date Range selected (only if no single date)
                    else if (dFrom && dTo) {
                        oPayload.StartDate = dFrom.toISOString();
                        oPayload.EndDate = dTo.toISOString();
                    }

                    //  Optional: If nothing selected, send today by default


                    this.getBusyDialog();

                    //  API Call with dynamic payload
                    var oResponse = await this.ajaxReadWithJQuery("AssignedTaskDetails", oPayload);

                    if (oResponse && oResponse.success) {
                        var oModel = new JSONModel(oResponse.data);
                        oView.setModel(oModel, "AssignmentModel");
                    } else {
                        MessageToast.show("Failed to fetch assignment data");
                    }

                } catch (error) {
                    MessageToast.show(
                        this.i18nModel?.getText("smgerrorassigntask") || "Something went wrong"
                    );
                } finally {
                    this.closeBusyDialog();
                }
            },
            MA_onPressClear: function () {
                var oView = this.getView();

                oView.byId("EA_id_Employee").setSelectedKey("");
                oView.byId("EA_id_StartDate").setValue("");
                oView.byId("EA_id_AssignDate").setValue("");

                // Reload default data

            },

            onPressback: function () {
                this.getRouter().navTo("");
            },

            onLogout: function () {
                this.CommonLogoutFunction();
            },
            AT_onPressback: function () {
                this.getRouter().navTo("RouteManageAssignment");
            }

        },
        );
    }
);