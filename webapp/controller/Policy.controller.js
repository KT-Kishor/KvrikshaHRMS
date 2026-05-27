sap.ui.define(
    [
        "./BaseController",
        "sap/ui/model/json/JSONModel",
        "sap/ui/core/Fragment",
        "sap/m/MessageBox",
        "sap/m/MessageToast",
        "../utils/validation",
        "../model/formatter",
    ],
    function(
        BaseController,
        JSONModel,
        Fragment,
        MessageBox,
        MessageToast,
        Validation,
        formatter,
    ) {
        "use strict";
        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.Policy", {
                Formatter: formatter,
                onInit: function() {
                    this.getRouter()
                        .getRoute("RoutePolicy")
                        .attachMatched(this.PL_onRouteMatched, this);
                    this._employeeCache = null;
                    this._employeePromise = null;
                    this.getView().setModel(
                        new JSONModel([]),
                        "FilteredRoleModel"
                    );
                    // SAFE LOGIN MODEL CHECK
                    var oLoginModel = this.getView().getModel("LoginModel");
                    var sRole = "";
                    if (oLoginModel) sRole = (oLoginModel.getProperty("/Role") || "").toLowerCase();
                    var bShowAdminControls = sRole === "admin" || sRole === "hr" || sRole === "hr manager";
                    this.getView().setModel(
                        new JSONModel({
                            showAdminControls: bShowAdminControls
                        }),
                        "visibilityModel"
                    );
                },
                _getEmployeeDetails: async function() {
                    if (this._employeeCache) {
                        return this._employeeCache;
                    }
                    // If request already running → reuse same promise
                    if (this._employeePromise) {
                        return this._employeePromise;
                    }
                    const sEmpId = this.getView()
                        .getModel("LoginModel")
                        .getProperty("/EmployeeID");
                    // store promise to prevent duplicate calls
                    this._employeePromise = this.ajaxReadWithJQuery("EmployeeDetails", {
                        EmployeeID: sEmpId
                    }).then((oEmpResponse) => {
                        if (
                            oEmpResponse &&
                            oEmpResponse.success &&
                            oEmpResponse.data &&
                            oEmpResponse.data.length > 0
                        ) {
                            const oEmployee = oEmpResponse.data[0];
                            this._employeeCache = {
                                department: (oEmployee.Department || "").toLowerCase().trim(),
                                role: (oEmployee.Role || "").toLowerCase().trim()
                            };
                            this.getView().getModel("LoginModel").setProperty("/Department", this._employeeCache.department);
                            this.getView().getModel("LoginModel").setProperty("/Role", this._employeeCache.role);
                        }
                        return this._employeeCache;
                    });
                    return this._employeePromise;
                },
                PL_loadRoleDepartment: async function() {
                    const oView = this.getView();
                    const oLoginModel = oView.getModel("LoginModel");
                    // LOGIN EMPLOYEE
                    const sEmpId = oLoginModel.getProperty("/EmployeeID");
                    // API CALL
                    const oResponse = await this.ajaxReadWithJQuery("Role_Department", {
                        EmpID: sEmpId
                    });
                    let aData = [];
                    // RESPONSE
                    if (oResponse && oResponse.success) {
                        aData = oResponse.data.map(function(item) {
                            return {
                                department: item.Department || "",
                                designationName: item.Role || ""
                            };
                        });
                    }
                    // FULL MODEL
                    this.getView().setModel(
                        new JSONModel(aData),
                        "DesignationModel"
                    );
                    // UNIQUE DEPARTMENT
                    const oDepartmentMap = {};
                    const aDepartments = [];
                    aData.forEach(function(oItem) {
                        const sDepartment =
                            (oItem.department || "").trim();
                        if (
                            sDepartment &&
                            !oDepartmentMap[sDepartment.toLowerCase()]
                        ) {
                            oDepartmentMap[
                                sDepartment.toLowerCase()
                            ] = true;
                            aDepartments.push({
                                department: sDepartment
                            });
                        }
                    });
                    // SET DEPARTMENT MODEL
                    this.getView().setModel(
                        new JSONModel(aDepartments),
                        "DepartmentModel"
                    );
                    // UNIQUE ROLES
                    const oRoleMap = {};
                    const aRoles = [];
                    aData.forEach(function(oItem) {
                        const sRole =
                            (oItem.designationName || "").trim();
                        const sDepartment =
                            (oItem.department || "").trim();
                        const sKey =
                            sDepartment.toLowerCase() +
                            "_" +
                            sRole.toLowerCase();
                        if (
                            sRole &&
                            !oRoleMap[sKey]
                        ) {
                            oRoleMap[sKey] = true;
                            aRoles.push({
                                department: sDepartment,
                                designationName: sRole
                            });
                        }
                    });
                    // SET ROLE MODEL
                    this.getView().setModel(
                        new JSONModel(aRoles),
                        "RoleModel"
                    );
                    // DEFAULT FILTERED ROLE MODEL
                    this.getView().setModel(
                        new JSONModel([]),
                        "FilteredRoleModel"
                    );
                },
                // POLICY VISIBILITY FILTER
                PL_filterPoliciesByAccess: async function(aPolicies) {
                    const oEmp = await this._getEmployeeDetails();
                    var sLoginDepartment = oEmp?.department || "";
                    var sLoginRole = oEmp?.role || "";
                    const aAdminRoles = ["admin", "hr", "hr manager"];
                    return aPolicies.filter(function(oPolicy) {
                        var sPolicyDepartment = (oPolicy.department || "").toLowerCase().trim();
                        var sPolicyRole = (oPolicy.role || "").toLowerCase().trim();
                        if (aAdminRoles.includes(sLoginRole)) return true;
                        if (sPolicyDepartment === "all" && sPolicyRole === "all") return true;
                        if (sPolicyDepartment === sLoginDepartment && sPolicyRole === "all") return true;
                        if (sPolicyDepartment === "all" && sPolicyRole === sLoginRole) return true;
                        if (sPolicyDepartment === sLoginDepartment && sPolicyRole === sLoginRole) return true;
                        return false;
                    });
                },
                // ROUTE MATCHED
                PL_onRouteMatched: async function() {
                    try {
                        // LOGIN VALIDATION
                        var LoginFunction = await this.commonLoginFunction("Policy");
                        if (!LoginFunction) return;
                        
                        // BUSY START
                        this.getBusyDialog();
                        const oView = this.getView();
                        const oLoginModel =
                            oView.getModel("LoginModel");
                        // i18n MODEL
                        this.i18nModel = this.getOwnerComponent()
                            .getModel("i18n")
                            .getResourceBundle();
                        // HEADER TITLE
                        oLoginModel.setProperty(
                            "/HeaderName",
                            this.i18nModel.getText("policyTitle")
                        );
                        // LOAD ROLE & DEPARTMENT
                        await this.PL_loadRoleDepartment();
                        // DEFAULT STATUS FILTER
                        var oStatusFilter =
                            this.byId("PL_id_StatusFilter");
                        oStatusFilter.setSelectedKey("Active");
                        // DATABASE READ CALL
                        // ONLY ACTIVE POLICIES
                        const oResponse =
                            await this.ajaxReadWithJQuery(
                                "Policy", {
                                    Status: "Active"
                                }
                            );
                        let aPolicies = [];
                        // RESPONSE DATA
                        if (
                            oResponse &&
                            oResponse.success &&
                            oResponse.data
                        ) {
                            aPolicies = oResponse.data.map(
                                function(oItem) {
                                    let sImageUrl =
                                        "sap-icon://person-placeholder";
                                    if (oItem.Logo) {
                                        if (
                                            typeof oItem.Logo === "string"
                                        ) {
                                            sImageUrl =
                                                "data:image/png;base64," +
                                                oItem.Logo;
                                        } else if (
                                            oItem.Logo.data
                                        ) {
                                            const sBase64 =
                                                new TextDecoder().decode(
                                                    new Uint8Array(
                                                        oItem.Logo.data
                                                    )
                                                );
                                            sImageUrl =
                                                "data:image/png;base64," +
                                                sBase64;
                                        }
                                    }
                                    return {
                                        ID: oItem.ID,
                                        name: oItem.PolicyName,
                                        desc: oItem.PolicyDesc,
                                        status: oItem.Status,
                                        uploadedDate: oItem.UploadDate ?
                                            new Date(
                                                oItem.UploadDate
                                            ).toLocaleDateString(
                                                "en-GB"
                                            ) : "",
                                        department: oItem.Department || "",
                                        role: oItem.Role || "",
                                        employeeIds: (
                                                oItem.EmployeeID || ""
                                            )
                                            .toString()
                                            .trim(),
                                        imageUrl: sImageUrl,
                                        fileContent: oItem.File || "",
                                        fileName: oItem.FileName,
                                        fileType: oItem.FileType,
                                        selected: false,
                                    };
                                }
                            );
                            // ROLE / DEPARTMENT ACCESS
                            aPolicies =
                                await this.PL_filterPoliciesByAccess(
                                    aPolicies
                                );
                        }
                        // SET POLICY MODEL
                        this.getView().setModel(
                            new JSONModel({
                                policies: aPolicies
                            }),
                            "policyModel"
                        );
                        // VIEW MODEL
                        this.getView().setModel(
                            new JSONModel({
                                EditBtn: true
                            }),
                            "VisibleModel"
                        );
                        // ROLE CHECK
                        var sRole =
                            (
                                oLoginModel.getProperty("/Role") ||
                                ""
                            ).toLowerCase();
                        var bShowAdminControls =
                            sRole === "admin" ||
                            sRole === "hr" ||
                            sRole === "hr manager";
                        // VISIBILITY MODEL
                        this.getView().setModel(
                            new JSONModel({
                                showAdminControls: bShowAdminControls
                            }),
                            "visibilityModel"
                        );
                        await this.PL_loadRoleDepartment();
                        // BUSY CLOSE
                        this.closeBusyDialog();
                    } catch (oError) {
                        this.closeBusyDialog();
                        MessageBox.error(
                            "Failed to load policies"
                        );
                    }
                },
                // LOAD POLICIES
                PL_loadPolicies: async function(aFilters = []) {
                    try {
                        const oResponse =
                            await this.ajaxReadWithJQuery(
                                "Policy",
                                aFilters && aFilters.length ?
                                aFilters[0] : {}
                            );
                        let aPolicies = [];
                        if (
                            oResponse &&
                            oResponse.success &&
                            oResponse.data
                        ) {
                            aPolicies = oResponse.data.map(function(oItem) {
                                let sImageUrl =
                                    "sap-icon://person-placeholder";
                                if (oItem.Logo) {
                                    if (typeof oItem.Logo === "string") {
                                        sImageUrl =
                                            "data:image/png;base64," +
                                            oItem.Logo;
                                    } else if (oItem.Logo.data) {
                                        const sBase64 =
                                            new TextDecoder().decode(
                                                new Uint8Array(
                                                    oItem.Logo.data
                                                )
                                            );
                                        sImageUrl =
                                            "data:image/png;base64," +
                                            sBase64;
                                    }
                                }
                                return {
                                    ID: oItem.ID,
                                    name: oItem.PolicyName,
                                    desc: oItem.PolicyDesc,
                                    status: oItem.Status,
                                    uploadedDate: oItem.UploadDate ?
                                        new Date(
                                            oItem.UploadDate
                                        ).toLocaleDateString(
                                            "en-GB"
                                        ) : "",
                                    department: oItem.Department ||
                                        oItem.department ||
                                        "",
                                    role: oItem.Role ||
                                        oItem.role ||
                                        "",
                                    employeeIds: (oItem.EmployeeID || "")
                                        .toString()
                                        .trim(),
                                    imageUrl: sImageUrl,
                                    fileContent: oItem.File || "",
                                    fileName: oItem.FileName,
                                    fileType: oItem.FileType,
                                    selected: false,
                                };
                            });
                            aPolicies =
                                await this.PL_filterPoliciesByAccess(
                                    aPolicies
                                );
                        }
                        this.getView().setModel(
                            new JSONModel({
                                policies: aPolicies,
                            }),
                            "policyModel"
                        );
                    } catch (oError) {
                        MessageBox.error(
                            "Failed to load policies"
                        );
                    }
                },
                // FILTER ROLE BASED ON DEPARTMENT
                PL_onDepartmentChange: function(oEvent) {
                    this.PL_onSelectionChangeValidation(oEvent);
                    var oDepartmentCombo = oEvent.getSource();
                    var sDepartment = (oDepartmentCombo.getSelectedKey() || "").trim();
                    // ROLE CONTROLS
                    var oRoleCreate = this.byId("PL_id_Role");
                    var oRoleFilter = this.byId("PL_id_RoleFilter");
                    var oRoleView = this.byId("PL_id_ViewRole");
                    // CLEAR ROLE ALWAYS
                    [oRoleCreate, oRoleFilter, oRoleView].forEach(function(oRole) {
                        if (oRole) {
                            oRole.setSelectedKey("");
                            oRole.setValue("");
                        }
                    });
                    // IF DEPARTMENT EMPTY
                    // SHOW NO DATA IN ROLE
                    if (!sDepartment) {
                        this.getView().setModel(
                            new JSONModel([]),
                            "FilteredRoleModel"
                        );
                        return;
                    }
                    // GET ALL ROLES
                    var aData =
                        this.getView()
                        .getModel("DesignationModel")
                        .getData() || [];
                    // FILTER ROLE
                    var aFilteredRoles = aData.filter(function(oItem) {
                        var sItemDepartment =
                            (oItem.department || "")
                            .trim()
                            .toLowerCase();
                        return (
                            sItemDepartment ===
                            sDepartment.toLowerCase()
                        );
                    });
                    // REMOVE DUPLICATES
                    var oUnique = {};
                    var aUniqueRoles = [];
                    aFilteredRoles.forEach(function(oItem) {
                        var sRole =
                            (oItem.designationName || "").trim();
                        if (sRole && !oUnique[sRole]) {
                            oUnique[sRole] = true;
                            aUniqueRoles.push({
                                designationName: sRole
                            });
                        }
                    });
                    // SET ROLE MODEL
                    this.getView().setModel(
                        new JSONModel(aUniqueRoles),
                        "FilteredRoleModel"
                    );
                },
                PL_onFileUpload: function(oEvent) {
                    const oFile = oEvent.getParameter("files")[0];
                    if (!oFile) {
                        return;
                    }
                    // BLOCK NON-PDF
                    if (oFile.type !== "application/pdf") {
                        MessageBox.error(
                            this.i18nModel.getText("onlyPdfAllowed")
                        );
                        // CLEAR FILE NAME FROM UI
                        oEvent.getSource().clear();
                        // CLEAR MODEL DATA
                        const oModel = this.getView()
                            .getModel("policyDialogModel");
                        oModel.setProperty("/fileContent", "");
                        oModel.setProperty("/fileName", "");
                        oModel.setProperty("/fileType", "");
                        return;
                    }
                    // READ FILE
                    const oReader = new FileReader();
                    oReader.onload = function(e) {
                        const base64 = e.target.result.split(",")[1];
                        const oModel = this.getView()
                            .getModel("policyDialogModel");
                        oModel.setProperty("/fileContent", base64);
                        oModel.setProperty("/fileName", oFile.name);
                        oModel.setProperty("/fileType", oFile.type);
                    }.bind(this);
                    oReader.readAsDataURL(oFile);
                },
                // CREATE
                PL_onCreatePress: function() {
                    const oDialogModel = new JSONModel({
                        ID: "",
                        title: "",
                        description: "",
                        status: "Active",
                        uploadedDate: new Date().toLocaleDateString("en-GB"),
                        department: "",
                        role: "",
                        // LOGO
                        logoBase64: "",
                        logoType: "",
                        logo: "",
                        // PDF
                        fileContent: "",
                        fileName: "",
                        fileType: "",
                        isEdit: false,
                    });
                    this.getView().setModel(oDialogModel, "policyDialogModel");
                    this.PL_openDialog();
                },
                // OPEN DIALOG
                PL_openDialog: function() {
                    if (!this.FPL_oDialog) {
                        Fragment.load({
                            id: this.getView().getId(),
                            name: "sap.kt.com.minihrsolution.fragment.PolicyDialog",
                            controller: this,
                        }).then(
                            function(oDialog) {
                                this.FPL_oDialog = oDialog;
                                this.getView().addDependent(oDialog);
                                oDialog.open();
                            }.bind(this),
                        );
                    } else {
                        this.FPL_oDialog.open();
                    }
                },
                // live validation
                // REMOVE ERROR FOR INPUT
                PL_onLiveChangeValidation: function(oEvent) {
                    var oField = oEvent.getSource();
                    var sValue = oField.getValue().trim();
                    if (sValue) {
                        oField.setValueState("None");
                        oField.setValueStateText("");
                    }
                },
                // REMOVE ERROR FOR SELECT
                PL_onSelectionChangeValidation: function(oEvent) {
                    var oField = oEvent.getSource();
                    var sKey = oField.getSelectedKey();
                    if (sKey) {
                        oField.setValueState("None");
                        oField.setValueStateText("");
                    }
                },
                // REMOVE ERROR FOR DATE
                PL_onDateValidation: function(oEvent) {
                    var oField = oEvent.getSource();
                    var sValue = oField.getValue().trim();
                    // EMPTY VALUE
                    if (!sValue) {
                        oField.setValueState("None");
                        oField.setValueStateText("");
                        return;
                    }
                    // VALID DATE
                    if (Validation._LCvalidateDate(oField, "ID")) {
                        // REMOVE RED ERROR
                        oField.setValueState("None");
                        oField.setValueStateText("");
                    } else {
                        // INVALID DATE
                        oField.setValueState("Error");
                    }
                },
                // SAVE
                PL_onSavePolicy: async function() {
                    try {
                        // TITLE VALIDATION
                        if (
                            !Validation._LCvalidateMandatoryField(
                                this.byId("PL_id_Title"),
                                "ID",
                            )
                        ) {
                            this.byId("PL_id_Title").setValueState("Error");
                            this.byId("PL_id_Title").setValueStateText(
                                "Policy title is required"
                            );
                            return;
                        }
                        // DESCRIPTION VALIDATION
                        if (
                            !Validation._LCvalidateMandatoryField(
                                this.byId("PL_id_Description"),
                                "ID",
                            )
                        ) {
                            this.byId("PL_id_Description").setValueState("Error");
                            this.byId("PL_id_Description").setValueStateText(
                                "Please enter policy description"
                            );
                            return;
                        }
                        // DEPARTMENT VALIDATION
                        if (
                            !Validation._LCstrictValidationComboBox(
                                this.byId("PL_id_Department"),
                                "ID"
                            )
                        ) {
                            this.byId("PL_id_Department")
                                .setValueState("Error");
                            this.byId("PL_id_Department")
                                .setValueStateText(
                                    "Please select a valid department"
                                );
                            return;
                        }
                        // ROLE VALIDATION
                        if (
                            !Validation._LCstrictValidationComboBox(
                                this.byId("PL_id_Role"),
                                "ID"
                            )
                        ) {
                            this.byId("PL_id_Role")
                                .setValueState("Error");
                            this.byId("PL_id_Role")
                                .setValueStateText(
                                    "Please select a valid role"
                                );
                            return;
                        }
                        // DATE VALIDATION
                        if (
                            !Validation._LCvalidateDate(this.byId("PL_id_UploadDate"), "ID")
                        ) {
                            this.byId("PL_id_UploadDate").setValueState("Error");
                            this.byId("PL_id_UploadDate").setValueStateText(
                                "Please enter a valid date"
                            );
                            return;
                        }
                        // MODEL DATA
                        const oData = this.getView()
                            .getModel("policyDialogModel")
                            .getData();
                        // PDF VALIDATION
                        if (!oData.fileContent) {
                            MessageBox.error("Please upload PDF");
                            return;
                        }
                        // PAYLOAD
                        const oPayloadData = {
                            EmployeeID: "",
                            PolicyName: oData.title,
                            PolicyDesc: oData.description,
                            Department: oData.department || "",
                            Role: oData.role || "",
                            File: oData.fileContent,
                            FileName: oData.fileName,
                            FileType: oData.fileType,
                            Logo: oData.logoBase64 || "",
                            Status: oData.status,
                            UploadDate: this._formatDateForDB(oData.uploadedDate),
                        };
                        // BUSY DIALOG
                        this.getBusyDialog();
                        // CLEAR FILE UPLOADERS
                        var aUploaders = this.getView().findAggregatedObjects(
                            true,
                            function(oControl) {
                                return oControl.isA("sap.ui.unified.FileUploader");
                            },
                        );
                        aUploaders.forEach(function(oUploader) {
                            oUploader.clear();
                        });
                        // UPDATE
                        if (oData.isEdit) {
                            const oUpdatePayload = {
                                filters: {
                                    ID: oData.ID,
                                },
                                data: oPayloadData,
                            };
                            await this.ajaxUpdateWithJQuery(
                                "Policy",
                                oUpdatePayload
                            );
                        } else {
                            // CREATE
                            await this.ajaxCreateWithJQuery(
                                "Policy", {
                                    data: oPayloadData,
                                }
                            );
                        }
                        // SUCCESS MESSAGE
                        MessageToast.show(
                            "Policy saved successfully"
                        );
                        // CLOSE DIALOG
                        this.FPL_oDialog.close();
                        // GET CURRENT STATUS FILTER
                        var sSelectedStatus =
                            this.byId("PL_id_StatusFilter")
                            .getSelectedKey();
                        // RELOAD POLICY BASED
                        // ON CURRENT FILTER
                        await this.PL_loadPolicies([{
                            Status: sSelectedStatus
                        }]);
                        // CLOSE BUSY
                        this.closeBusyDialog();
                    } catch (oError) {
                        this.closeBusyDialog();
                        MessageBox.error("Save failed");
                    }
                },
                // CANCEL
                PL_onCancelPolicy: function() {
                    // RESET MODEL
                    this.getView().setModel(
                        new JSONModel({
                            ID: "",
                            title: "",
                            description: "",
                            status: "Active",
                            uploadedDate: new Date().toLocaleDateString("en-GB"),
                            department: "",
                            role: "",
                            // LOGO
                            logoBase64: "",
                            logoType: "",
                            logo: "",
                            // PDF
                            fileContent: "",
                            fileName: "",
                            fileType: "",
                            isEdit: false,
                        }),
                        "policyDialogModel",
                    );
                    this.byId("PL_id_Title").setValueState("None");
                    this.byId("PL_id_Description").setValueState("None");
                    this.byId("PL_id_Department").setValueState("None");
                    this.byId("PL_id_Role").setValueState("None");
                    // CLEAR FILE UPLOADERS
                    var aUploaders = this.getView().findAggregatedObjects(
                        true,
                        function(oControl) {
                            return oControl.isA("sap.ui.unified.FileUploader");
                        },
                    );
                    aUploaders.forEach(function(oUploader) {
                        oUploader.clear();
                    });
                    // CLOSE DIALOG
                    if (this.FPL_oDialog) {
                        this.FPL_oDialog.close();
                    }
                },
                // LOGO UPLOAD
                PL_onLogoUpload: function(oEvent) {
                    const oFile = oEvent.getParameter("files")[0];
                    if (!oFile) return;
                    if (!oFile.type.startsWith("image/")) {
                        MessageBox.error("Only images allowed");
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const base64 = e.target.result.split(",")[1];
                        const oModel = this.getView().getModel("policyDialogModel");
                        oModel.setProperty("/logoBase64", base64);
                        oModel.setProperty("/logoType", oFile.type);
                        // oModel.setProperty("/fileName", oFile.name);
                    }.bind(this);
                    reader.readAsDataURL(oFile);
                },
                // LOGO TYPE VALIDATION
                PL_onLogoTypeMissmatch: function() {
                    MessageBox.error(
                        this.i18nModel.getText("onlyImagesAllowed")
                    );
                },
                // LOGO SIZE EXCEED
                PL_onLogoSizeExceed: function() {
                    MessageBox.error(
                        this.i18nModel.getText("logoSizeExceeded")
                    );
                },
                PL_onViewPolicy: async function(oEvent) {
                    const oObject = oEvent
                        .getSource()
                        .getBindingContext("policyModel")
                        .getObject();
                    this._selectedPolicyId = oObject.ID;
                    try {
                        this.getBusyDialog();
                        const oResponse = await this.ajaxReadWithJQuery("PolicyImage", {
                            ID: oObject.ID,
                        });
                        if (!oResponse || !oResponse.success) {
                            this.closeBusyDialog();
                            MessageBox.error("No PDF data found");
                            return;
                        }
                        // GET BASE64
                        let sBase64 = oResponse.File || oResponse.data?.File || "";
                        if (!sBase64) {
                            this.closeBusyDialog();
                            MessageBox.error("PDF Base64 is empty");
                            return;
                        }
                        // CLEAN BASE64
                        sBase64 = String(sBase64)
                            .replace(/^data:.*;base64,/, "")
                            .replace(/\s/g, "");
                        // DIRECT BASE64 PDF URL
                        this._policyPdfUrl = "data:application/pdf;base64," + sBase64;
                        // VALID PDF CHECK
                        if (!sBase64.startsWith("JVBER")) {
                            this.closeBusyDialog();
                            MessageBox.error("Invalid PDF file");
                            return;
                        }
                        // LOGIN EMPLOYEE ID
                        const sEmployeeId = String(
                            this.getView().getModel("LoginModel").getProperty("/EmployeeID"),
                        ).trim();
                        // READ EMPLOYEE IDS FROM DB
                        let sAckIds = "";
                        // SAFE READ
                        if (
                            oResponse.data &&
                            Array.isArray(oResponse.data) &&
                            oResponse.data.length > 0
                        ) {
                            sAckIds = oResponse.data[0].EmployeeID || "";
                        } else if (oResponse.data && oResponse.data.EmployeeID) {
                            sAckIds = oResponse.data.EmployeeID;
                        } else if (oResponse.EmployeeID) {
                            sAckIds = oResponse.EmployeeID;
                        }
                        // CLEAN
                        sAckIds = String(sAckIds).trim();
                        // ARRAY
                        const aAckIds = sAckIds
                            .split(",")
                            .map(function(id) {
                                return id.trim();
                            })
                            .filter(Boolean);
                        // CHECK EMPLOYEE EXISTS
                        const bAlreadyAcknowledged = aAckIds.includes(sEmployeeId);
                        const oViewModel = new JSONModel({
                            title: oObject.name,
                            description: oObject.desc,
                            status: oObject.status,
                            uploadedDate: oObject.uploadedDate,
                            department: oObject.department ||
                                oObject.Department ||
                                oObject.Dept ||
                                oObject.DepartmentName ||
                                "",
                            role: oObject.role || oObject.Role || "",
                            fileName: oResponse.FileName || "Policy.pdf",
                            fileType: "application/pdf",
                            fileUrl: this._policyPdfUrl,
                            acknowledged: false,
                            employeeIds: sAckIds,
                            alreadyAcknowledged: bAlreadyAcknowledged === true,
                        });
                        this.getView().setModel(oViewModel, "policyViewModel");
                        oViewModel.setProperty(
                            "/alreadyAcknowledged",
                            bAlreadyAcknowledged,
                        );
                        this.closeBusyDialog();
                        this.PL_openViewDialog();
                    } catch (e) {
                        this.closeBusyDialog();
                        MessageBox.error("Failed to load PDF");
                    }
                },
                onAcknowledgeCheck: function(oEvent) {
                    const bSelected = oEvent.getParameter("selected");
                    this.getView()
                        .getModel("policyViewModel")
                        .setProperty("/acknowledged", bSelected);
                },
                onPressAcknowledge: function() {
                    const sEmployeeId = String(
                        this.getView().getModel("LoginModel").getProperty("/EmployeeID")
                    ).trim();
                    const oViewModel = this.getView().getModel("policyViewModel");
                    // EXISTING IDS
                    let sExistingIds = oViewModel.getProperty("/employeeIds") || "";
                    // ARRAY
                    let aIds = sExistingIds ? sExistingIds.split(",") : [];
                    // CLEAN IDS
                    aIds = aIds
                        .map(function(id) {
                            return id.trim();
                        })
                        .filter(Boolean);
                    // ADD ONLY IF NOT EXISTS
                    if (!aIds.includes(sEmployeeId)) {
                        aIds.push(sEmployeeId);
                    }
                    // FINAL IDS
                    const sFinalIds = aIds.join(",");
                    // CONFIRMATION
                    MessageBox.confirm(
                        "Are you sure you want to acknowledge this policy?", {
                            title: "Confirmation",
                            actions: [
                                MessageBox.Action.YES,
                                MessageBox.Action.NO,
                            ],
                            emphasizedAction: MessageBox.Action.YES,
                            onClose: function(sAction) {
                                if (sAction !== MessageBox.Action.YES) {
                                    oViewModel.setProperty("/acknowledged", false);
                                    return;
                                }
                                // BUSY START
                                this.getBusyDialog();
                                // UPDATE CALL
                                this.ajaxUpdateWithJQuery("Policy", {
                                        filters: {
                                            ID: this._selectedPolicyId,
                                        },
                                        data: {
                                            EmployeeID: sFinalIds,
                                        },
                                    })
                                    .then(
                                        function() {
                                            // MODEL UPDATE
                                            oViewModel.setProperty(
                                                "/employeeIds",
                                                sFinalIds
                                            );
                                            oViewModel.setProperty(
                                                "/alreadyAcknowledged",
                                                true
                                            );
                                            oViewModel.setProperty(
                                                "/acknowledged",
                                                true
                                            );
                                            oViewModel.refresh(true);
                                            // REFRESH POLICY LIST
                                            this.PL_loadPolicies();
                                            // BUSY CLOSE
                                            this.closeBusyDialog();
                                            // SUCCESS MESSAGE
                                            MessageToast.show(
                                                "Policy acknowledged successfully"
                                            );
                                            // CLOSE DIALOG
                                            if (this.FPL_oViewDialog) {
                                                this.FPL_oViewDialog.close();
                                            }
                                        }.bind(this)
                                    )
                                    .catch(
                                        function() {
                                            // BUSY CLOSE
                                            this.closeBusyDialog();
                                            // ERROR MESSAGE
                                            MessageBox.error(
                                                "Failed to acknowledge policy. Please try again."
                                            );
                                        }.bind(this)
                                    );
                            }.bind(this),
                        }
                    );
                },
                _createPdfIframe: function() {
                    const sPdfUrl = this.getView()
                        .getModel("policyViewModel")
                        .getProperty("/fileUrl");
                    const oHtml = this.byId("pdfFrame");
                    const sIframe =
                        "<iframe " +
                        "src='" +
                        sPdfUrl +
                        "#toolbar=0&navpanes=0&scrollbar=0' " +
                        "width='100%' " +
                        "height='300px' " +
                        "style='border:none;'>" +
                        "</iframe>";
                    oHtml.setContent(sIframe);
                },
                PL_openViewDialog: function() {
                    this.getView()
                        .getModel("VisibleModel")
                        .setProperty("/EditBtn", true);
                    this.getBusyDialog();
                    const fnLoadPdf = function() {
                        setTimeout(
                            function() {
                                this._createPdfIframe();
                            }.bind(this),
                        );
                    }.bind(this);
                    // NEW: REFRESH POLICY + EMPLOYEE IDS
                    const fnRefreshPolicyData = async function() {
                        try {
                            const [oPolicyResponse, oPolicyImageResponse] = await Promise.all([
                                this.ajaxReadWithJQuery("Policy", {
                                    ID: this._selectedPolicyId,
                                }),
                                this.ajaxReadWithJQuery("PolicyImage", {
                                    ID: this._selectedPolicyId,
                                }),
                            ]);
                            let sAckIds = "";
                            if (
                                oPolicyResponse.data &&
                                Array.isArray(oPolicyResponse.data) &&
                                oPolicyResponse.data.length > 0
                            ) {
                                sAckIds = oPolicyResponse.data[0].EmployeeID || "";
                            } else if (oPolicyResponse.data?.EmployeeID) {
                                sAckIds = oPolicyResponse.data.EmployeeID;
                            } else if (oPolicyResponse.EmployeeID) {
                                sAckIds = oPolicyResponse.EmployeeID;
                            }
                            sAckIds = String(sAckIds).trim();
                            const aAckIds = sAckIds
                                .split(",")
                                .map((id) => id.trim())
                                .filter(Boolean);
                            const sEmployeeId = String(
                                this.getView()
                                .getModel("LoginModel")
                                .getProperty("/EmployeeID")
                            ).trim();
                            const bAlreadyAcknowledged = aAckIds.includes(sEmployeeId);
                            const oModel = this.getView().getModel("policyViewModel");
                            oModel.setProperty("/employeeIds", sAckIds);
                            oModel.setProperty("/alreadyAcknowledged", bAlreadyAcknowledged);
                            // IMPORTANT: store PDF response too if needed
                            let sBase64 = oPolicyImageResponse.File || oPolicyImageResponse.data?.File || "";
                            sBase64 = String(sBase64)
                                .replace(/^data:.*;base64,/, "")
                                .replace(/\s/g, "");
                            this._policyPdfUrl = "data:application/pdf;base64," + sBase64;
                            oModel.setProperty("/fileUrl", this._policyPdfUrl);
                        } catch (e) {}
                    }.bind(this);
                    if (this.FPL_oViewDialog) {
                        this.FPL_oViewDialog.open();
                        Promise.all([
                            fnRefreshPolicyData(),
                            fnLoadPdf(),
                        ]).finally(() => {
                            this.closeBusyDialog();
                        });
                        return;
                    }
                    Fragment.load({
                        id: this.getView().getId(),
                        name: "sap.kt.com.minihrsolution.fragment.PolicyViewDialog",
                        controller: this,
                    }).then(
                        function(oDialog) {
                            this.FPL_oViewDialog = oDialog;
                            this.getView().addDependent(oDialog);
                            oDialog.open();
                            Promise.all([
                                fnRefreshPolicyData(),
                                fnLoadPdf(),
                            ]).finally(() => {
                                this.closeBusyDialog();
                            });
                        }.bind(this),
                    );
                },
                // go button 
                PL_onSearchPolicy: async function() {
                    try {
                        this.getBusyDialog();
                        // FILTER VALUES
                        const sSearch = this.byId("PL_id_SearchPolicy")
                            .getValue()
                            .trim();
                        const sStatus = this.byId("PL_id_StatusFilter")
                            .getValue()
                            .trim();
                        const sDepartment = this.byId("PL_id_DepartmentFilter")
                            .getValue()
                            .trim();
                        const sRole = this.byId("PL_id_RoleFilter")
                            .getValue()
                            .trim();
                        // DATABASE CALL
                        const oResponse = await this.ajaxReadWithJQuery(
                            "Policy", {
                                PolicyName: sSearch,
                                Status: sStatus,
                                Department: sDepartment,
                                Role: sRole,
                            }
                        );
                        let aPolicies = [];
                        if (oResponse &&
                            oResponse.success &&
                            oResponse.data) {
                            aPolicies = oResponse.data.map(function(oItem) {
                                let sImageUrl =
                                    "sap-icon://person-placeholder";
                                if (oItem.Logo) {
                                    if (typeof oItem.Logo === "string") {
                                        sImageUrl =
                                            "data:image/png;base64," +
                                            oItem.Logo;
                                    } else if (oItem.Logo.data) {
                                        const sBase64 =
                                            new TextDecoder().decode(
                                                new Uint8Array(
                                                    oItem.Logo.data
                                                )
                                            );
                                        sImageUrl =
                                            "data:image/png;base64," +
                                            sBase64;
                                    }
                                }
                                return {
                                    ID: oItem.ID,
                                    name: oItem.PolicyName,
                                    desc: oItem.PolicyDesc,
                                    status: oItem.Status,
                                    uploadedDate: oItem.UploadDate ?
                                        new Date(oItem.UploadDate)
                                        .toLocaleDateString("en-GB") : "",
                                    department: oItem.Department || "",
                                    role: oItem.Role || "",
                                    employeeIds: (oItem.EmployeeID || "")
                                        .toString()
                                        .trim(),
                                    imageUrl: sImageUrl,
                                    fileContent: oItem.File || "",
                                    fileName: oItem.FileName,
                                    fileType: oItem.FileType,
                                    selected: false,
                                };
                            });
                            // APPLY ROLE /
                            // DEPARTMENT SECURITY
                            aPolicies = await this.PL_filterPoliciesByAccess(aPolicies);
                        }
                        // UPDATE MODEL
                        this.getView()
                            .getModel("policyModel")
                            .setProperty("/policies", aPolicies);
                    } catch (oError) {
                        MessageBox.error(
                            "Failed to load policies"
                        );
                    } finally {
                        this.closeBusyDialog();
                    }
                },
                PL_onClearPolicy: function() {
                    // SEARCH
                    this.byId("PL_id_SearchPolicy").setValue("");
                    // STATUS
                    this.byId("PL_id_StatusFilter").setSelectedKey("");
                    // DEPARTMENT
                    this.byId("PL_id_DepartmentFilter").setSelectedKey("");
                    // ROLE
                    this.byId("PL_id_RoleFilter").setSelectedKey("");
                },
                PL_onLiveSearchPolicy: function(oEvent) {
                    var sValue = oEvent.getParameter("newValue").toLowerCase();
                    var oModel = this.getView().getModel("policyModel");
                    // Store original data once
                    if (!this._aAllPolicies) {
                        this._aAllPolicies = oModel.getProperty("/policies");
                    }
                    var aFilteredPolicies;
                    // If search empty -> restore all data
                    if (!sValue) {
                        aFilteredPolicies = this._aAllPolicies;
                    } else {
                        aFilteredPolicies = this._aAllPolicies.filter(function(oPolicy) {
                            return (
                                oPolicy.name && oPolicy.name.toLowerCase().includes(sValue)
                            );
                        });
                    }
                    oModel.setProperty("/policies", aFilteredPolicies);
                },
                PL_onPressEditAndSave: function(oEvent) {
                    debugger;
                    if (oEvent.getSource().getText() === "Edit") {
                        this.onPressEdit();
                    } else {
                        this.onPressSave();
                    }
                },
                _updateRoleModel: function(sDepartment) {
                    var aData = this.getView()
                        .getModel("DesignationModel")
                        .getData() || [];
                    var aFilteredRoles = aData.filter(function(oItem) {
                        return (oItem.department || "").trim().toLowerCase() === sDepartment.toLowerCase();
                    });
                    var oUnique = {};
                    var aUniqueRoles = [];
                    aFilteredRoles.forEach(function(oItem) {
                        var sRole = (oItem.designationName || "").trim();
                        if (sRole && !oUnique[sRole]) {
                            oUnique[sRole] = true;
                            aUniqueRoles.push({
                                designationName: sRole
                            });
                        }
                    });
                    this.getView().setModel(
                        new JSONModel(aUniqueRoles),
                        "FilteredRoleModel"
                    );
                },
                onPressEdit: function() {
                    // SWITCH TO EDIT MODE
                    this.getView()
                        .getModel("VisibleModel")
                        .setProperty("/EditBtn", false);
                    // GET CURRENT POLICY DATA
                    var oPolicyModel = this.getView().getModel("policyViewModel");
                    var sDepartment = (oPolicyModel.getProperty("/department") || "").trim();
                    // UPDATE ROLE MODEL BASED ON DEPARTMENT
                    if (sDepartment) {
                        this._updateRoleModel(sDepartment);
                    }
                    // OPTIONAL: FORCE UI UPDATE (SAFETY)
                    var oRoleCombo = this.byId("PL_id_ViewRole");
                    if (oRoleCombo && oRoleCombo.getBinding("items")) {
                        oRoleCombo.getBinding("items").refresh();
                    }
                },
                onPressSave: async function() {
                    // TITLE VALIDATION
                    if (
                        !Validation._LCvalidateMandatoryField(
                            this.byId("PL_id_ViewTitle"),
                            "ID"
                        )
                    ) {
                        this.byId("PL_id_ViewTitle")
                            .setValueState("Error");
                        this.byId("PL_id_ViewTitle")
                            .setValueStateText(
                                "Policy title is required"
                            );
                        return;
                    }
                    // DESCRIPTION VALIDATION
                    if (
                        !Validation._LCvalidateMandatoryField(
                            this.byId("PL_id_ViewDescription"),
                            "ID"
                        )
                    ) {
                        this.byId("PL_id_ViewDescription")
                            .setValueState("Error");
                        this.byId("PL_id_ViewDescription")
                            .setValueStateText(
                                "Please enter policy description"
                            );
                        return;
                    }
                    // DEPARTMENT VALIDATION
                    if (
                        !Validation._LCstrictValidationComboBox(
                            this.byId("PL_id_ViewDepartment"),
                            "ID"
                        )
                    ) {
                        this.byId("PL_id_ViewDepartment")
                            .setValueState("Error");
                        this.byId("PL_id_ViewDepartment")
                            .setValueStateText(
                                "Please select a valid department"
                            );
                        return;
                    }
                    // ROLE VALIDATION
                    if (
                        !Validation._LCstrictValidationComboBox(
                            this.byId("PL_id_ViewRole"),
                            "ID"
                        )
                    ) {
                        this.byId("PL_id_ViewRole")
                            .setValueState("Error");
                        this.byId("PL_id_ViewRole")
                            .setValueStateText(
                                "Please select a valid role"
                            );
                        return;
                    }
                    // MODEL DATA
                    const oModel =
                        this.getView().getModel("policyViewModel");
                    const oData = oModel.getData();
                    // UPDATE PAYLOAD
                    const oPayload = {
                        filters: {
                            ID: this._selectedPolicyId,
                        },
                        data: {
                            PolicyName: oData.title,
                            PolicyDesc: oData.description,
                            Department: oData.department,
                            Role: oData.role,
                            Status: oData.status,
                            UploadDate: this._formatDateForDB(
                                oData.uploadedDate
                            ),
                        },
                    };
                    try {
                        // BUSY START
                        this.getBusyDialog();
                        // UPDATE POLICY
                        await this.ajaxUpdateWithJQuery(
                            "Policy",
                            oPayload
                        );
                        // GET CURRENT STATUS FILTER
                        var sSelectedStatus =
                            this.byId("PL_id_StatusFilter")
                            .getSelectedKey();
                        // READ POLICY AGAIN
                        // BASED ON CURRENT FILTER
                        await this.PL_loadPolicies([{
                            Status: sSelectedStatus
                        }]);
                        // ENABLE EDIT BUTTON
                        this.getView()
                            .getModel("VisibleModel")
                            .setProperty("/EditBtn", true);
                        // CLOSE DIALOG
                        if (this.FPL_oViewDialog) {
                            this.FPL_oViewDialog.close();
                        }
                        // BUSY CLOSE
                        this.closeBusyDialog();
                        // SUCCESS MESSAGE
                        MessageToast.show(
                            "Policy updated successfully"
                        );
                    } catch (oError) {
                        this.closeBusyDialog();
                        MessageBox.error(
                            "Update failed"
                        );
                    }
                },
                // FORMAT DATE FOR DB
                _formatDateForDB: function(sDate) {
                    if (!sDate) {
                        return "";
                    }
                    // INPUT => 21/05/2026
                    var aParts = sDate.split("/");
                    // OUTPUT => 2026-05-21
                    return aParts[2] + "-" + aParts[1] + "-" + aParts[0];
                },
                onPressback: function() {
                    this.getRouter().navTo("RouteTilePage");
                },
                onLogout: function() {
                    this.CommonLogoutFunction();
                },
                Tile_NotifictionBTN: function() {
                    this.getRouter().navTo("RouteNotification");
                },
                TP_onraisebugpress: function() {
                    this.getRouter().navTo("RouteRaiseBug");
                },
                // view dialog close
                PL_onCloseViewDialog: function() {
                    this.getView()
                        .getModel("VisibleModel")
                        .setProperty("/EditBtn", true);
                    // REMOVE VALUE STATE ERRORS
                    if (this.byId("PL_id_ViewTitle")) {
                        this.byId("PL_id_ViewTitle").setValueState("None");
                    }
                    if (this.byId("PL_id_ViewDescription")) {
                        this.byId("PL_id_ViewDescription").setValueState("None");
                    }
                    if (this.byId("PL_id_ViewDepartment")) {
                        this.byId("PL_id_ViewDepartment").setValueState("None");
                    }
                    if (this.byId("PL_id_ViewRole")) {
                        this.byId("PL_id_ViewRole").setValueState("None");
                    }
                    if (this.byId("PL_id_ViewUploadDate")) {
                        this.byId("PL_id_ViewUploadDate").setValueState("None");
                    }
                    if (this.FPL_oViewDialog) {
                        this.FPL_oViewDialog.close();
                    }
                },
                onStatusChange: function(oEvent) {
                    const bState = oEvent.getParameter("state");
                    this.getView()
                        .getModel("policyViewModel")
                        .setProperty("/status", bState ? "Active" : "Inactive");
                },
            },
        );
    },
);