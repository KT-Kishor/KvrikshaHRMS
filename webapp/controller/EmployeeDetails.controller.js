sap.ui.define([
        "./BaseController", "sap/m/MessageToast", "../model/formatter", "sap/ui/export/Spreadsheet"
    ],
    function(BaseController, MessageToast, Formatter, Spreadsheet) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.EmployeeDetails", {
            Formatter: Formatter,
            onInit: function() {
                this.getRouter().getRoute("RouteEmployeeDetails").attachMatched(this._onRouteMatched, this);
            },
            _onRouteMatched: async function(oEvent) {
                try {

                    this._sPath = oEvent.getParameter("arguments").sPath || "";

                    var LoginFunction = await this.commonLoginFunction("EmployeeDetails");
                    if (!LoginFunction) return;

                    this.getBusyDialog();

                    if (this._sPath === "EmployeeDetails") {
                        this.onClearEmployeeDetails();
                    }

                    this.i18nModel = this.getView().getModel("i18n").getResourceBundle();

                    this.getView().getModel("LoginModel")
                        .setProperty("/HeaderName", "Employee Details");

                    this.byId("ED_id_Status").setSelectedKey("Active");

                    this.Emp_det_onSearch();

                    this.closeBusyDialog();

                } catch (error) {

                    this.closeBusyDialog();

                    MessageToast.show(
                        this.i18nModel.getText("commonErrorMessage")
                    );
                }

                this.initializeBirthdayCarousel();
            },

            Emp_det_onSearch: async function() {
                try {
                    this.getBusyDialog();
                    const aFilterItems = this.byId("ED_id_FilterBar").getFilterGroupItems();
                    if (this.getView().getModel("LoginModel").getProperty("/Role") === "Admin" || this.getView().getModel("LoginModel").getProperty("/Role") === "HR" || this.getView().getModel("LoginModel").getProperty("/Role") === "HR Manager") {
                        var params = {};
                    } else {
                        var params = {
                            ManagerID: this.getView().getModel("LoginModel").getProperty("/EmployeeID")
                        };
                    }
                    aFilterItems.forEach(function(oItem) {
                        const oControl = oItem.getControl();
                        const sKey = oItem.getName();
                        const sValue = (typeof oControl.getSelectedKey === "function" && oControl.getSelectedKey()) ||
                            (typeof oControl.getValue === "function" && oControl.getValue().trim());

                        if (sValue) {
                            params[sKey] = sValue;
                        }
                    });

                    await this._fetchCommonData("EmployeeDetails", "sEmployeeDetails", params);
                    const allData = this.getView().getModel("sEmployeeDetails").getData();

                    const paramKeys = Object.keys(params);

                    const userSelectedKeys = paramKeys.filter(key => {
                        return key !== "ManagerID" && params[key] !== "" && params[key] !== undefined && params[key] !== null;
                    });

                    const isStatusOnlyActive = paramKeys.length === 1 && userSelectedKeys.includes("EmployeeStatus") && params["EmployeeStatus"] === "Active";
                    const isFilterBarEmpty = userSelectedKeys.length === 0;

                    // Trigger the model update if either condition is met
                    if (isStatusOnlyActive || isFilterBarEmpty) {
                        if (!this.getView().getModel("sEmployeeDetailsAll")) {
                            this.getView().setModel(new sap.ui.model.json.JSONModel(allData), "sEmployeeDetailsAll");
                        } else {
                            this.getView().getModel("sEmployeeDetailsAll").setData(allData);
                        }
                    }

                    let filteredData = allData.filter((item) => {
                        let match = true;
                        for (let key in params) {
                            if (item.hasOwnProperty(key)) {
                                if (key === "Type") {
                                    if (params.Type === "Trainee") {
                                        match = match && item.EmployeeID.startsWith("KT-T");
                                    } else if (params.Type === "Employee") {
                                        match = match && item.EmployeeID.startsWith("KT") && !item.EmployeeID.startsWith("KT-T");
                                    }
                                } else {
                                    if (item[key] == null || !item[key].toString().toLowerCase().includes(params[key].toLowerCase())) {
                                        match = false;
                                    }
                                }
                            } else {
                                match = false;
                            }
                        }
                        return match;
                    });

                    // =====================================
                    // REMOVE CONTRACTOR & TRAINEE
                    // FOR GOAL REVIEW FLOW
                    // =====================================

                    if (this._sPath === "GoalEmployeeDetailsManageGoal") {

                        filteredData = filteredData.filter(function(item) {

                            return (
                                item.Role !== "Contractor" &&
                                item.Role !== "Trainee"
                            );

                        });
                    }

                    // =====================================
                    // SET FILTERED DATA
                    // =====================================

                    this.getView()
                        .getModel("sEmployeeDetails")
                        .setData(filteredData);
                    this.closeBusyDialog();
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("commonErrorMessage"));
                }
            },

            onClearEmployeeDetails: function() {
                var aFilterItems = this.byId("ED_id_FilterBar").getFilterGroupItems();
                aFilterItems.forEach(function(oItem) {
                    var oControl = oItem.getControl(); // Get the associated control
                    if (oControl) {
                        if (oControl.setValue) {
                            oControl.setValue(""); // Clear value for ComboBox, Input, DatePicker, etc.
                        }
                        if (oControl.setSelectedKey) {
                            oControl.setSelectedKey(""); // Reset selection for dropdowns
                        }
                        if (oControl.setSelected) {
                            oControl.setSelected(false); // Reset selection for Checkboxes
                        }
                    }
                });
            },

            CommonReadCall: async function() {
                await this._fetchCommonData("EmployeeDetails", "FilterEmployeeDetails", {});
            },
            onPressback: function() {
                this.getRouter().navTo("RouteTilePage");
            },
            onLogout: function() {
                this.CommonLogoutFunction();
            },

            ED_onPressEmployeeRow: function(oEvent) {

                var oContext = oEvent.getSource()
                    .getBindingContext("sEmployeeDetails");

                var EmployeeID = oContext.getProperty("EmployeeID");

                var EmployeeRole = oContext.getProperty("Role");

                // GOAL REVIEW FLOW
                if (this._sPath === "GoalEmployeeDetailsManageGoal") {

                    this.getRouter().navTo("RouteManagegoals", {
                        employeeId: EmployeeID,
                        from: "GoalReview"
                    });

                }

                // NORMAL EMPLOYEE DETAILS FLOW
                else {

                    this.getRouter().navTo("SelfService", {
                        sPath: EmployeeID,
                        Role: EmployeeRole
                    });

                }
            },
            getGroupHeader: function(oGroup) {
                return this.getStyledGroupHeader(oGroup);
            },

            ED_onDownloaData: function() {
                var table = this.byId("ED_id_EmpDetailsTable");
                const oModelData = table.getModel("sEmployeeDetails").getData();
                const aFormattedData = oModelData.map(item => {
                    return {
                        ...item,
                        //   EndDate: Formatter.formatDate(item.EndDate),
                        //   StartDate: Formatter.formatDate(item.StartDate),
                        //   SubmittedDate: Formatter.formatDate(item.SubmittedDate),
                    };
                });
                const aCols = [{
                        label: this.i18nModel.getText("employeeID"),
                        property: "EmployeeID",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("employeeName"),
                        property: "EmployeeName",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("designation"),
                        property: "Designation",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("role"),
                        property: "Role",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("managerId"),
                        property: "ManagerID",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("managerName"),
                        property: "ManagerName",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("email"),
                        property: "EmployeeEmail",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("mobilenumber"),
                        property: "MobileNo",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("baseLocation"),
                        property: "Branch",
                        type: "string"
                    },
                ];
                const oSettings = {
                    workbook: {
                        columns: aCols,
                        context: {
                            sheetName: this.i18nModel.getText("headerEmpDetails")
                        }
                    },
                    dataSource: aFormattedData,
                    fileName: "Employee_Details.xlsx"
                };
                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().then(function() {
                        MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
                    }.bind(this))
                    .finally(function() {
                        oSheet.destroy();
                    });
            }
        });
    });