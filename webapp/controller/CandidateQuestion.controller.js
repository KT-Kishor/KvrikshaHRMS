sap.ui.define(
  [
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "../utils/validation",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Filter",
    "../model/formatter",
  ],
  function (BaseController, JSONModel, MessageBox, MessageToast, utils, FilterOperator, Filter, Formatter) {
    "use strict";

    return BaseController.extend(  "sap.kt.com.minihrsolution.controller.CandidateQuestion", {
         Formatter: Formatter,
        onInit: function () {
          this.getRouter().getRoute("RouteManageCandidateQuestion")
            .attachPatternMatched(this.QD_onRouteMatched, this);
        },

        QD_onRouteMatched: async function () {
          var LoginFunction = await this.commonLoginFunction("SelfService");
          if (!LoginFunction) return;
          // this.getBusyDialog();
          const oView = this.getView();
          const oLoginModel = oView.getModel("LoginModel");
          const oLoginData = oLoginModel.getData();
          this.oLoginModel = oLoginData;
          this.i18nModel = this.getOwnerComponent().getModel("i18n").getResourceBundle();
          this.byId("CQ_id_Department").setSelectedKey("")

          var oData = {
            test_id: "1",
            type: "",
            question_text: "",
            marks: "",
            order_no: "",
            options: []
          };

          var oModel = new JSONModel(oData);
          this.getView().setModel(oModel, "questionModel");
          oLoginModel.setProperty("/HeaderName", this.i18nModel.getText("candidatequestion"));
          await this.CQ_loadQuestionsData();
          this.oview = this.getView()
        },
        onAddOption: function () {
          var oModel = this.oview.getModel("questionModel");
          var aOptions = oModel.getProperty("/options") || []

          aOptions.push({
            option_text: "",
            is_correct: "false",
            order_no: aOptions.length + 1
          });

          oModel.setProperty("/options", aOptions);

        },

        CQ_loadQuestionsData: async function (sType = "") {

          try {

            this.getBusyDialog();
            let sQuery = "";
            if (sType) {
              sQuery =
                "?type=" + encodeURIComponent(sType) 
            } 
            const result = await this.ajaxReadWithJQuery(
              "Questions",
              sQuery
            );
            const aData = Array.isArray(result?.questions)
              ? result.questions
              : [];

            // Create unique type list
            const aUniqueTypes = [
              ...new Set(
                aData
                  .map(item => (item.type || "").trim())
                  .filter(Boolean)
              )
            ].map(function (sType) {
              return {
                type: sType
              };
            });

            // Question Model
            let oQuestionModel = this.getView().getModel("Questionmodel");
            if (!oQuestionModel) {
              oQuestionModel = new JSONModel({
                Questions: [],
                AllQuestions: []
              });

              this.getView().setModel(
                oQuestionModel,
                "Questionmodel"
              );
            }

            oQuestionModel.setProperty("/Questions", aData);

            // Store complete data for clear/reset
            if (!sType) {
              oQuestionModel.setProperty("/AllQuestions", aData);
            }

            // Filter Model
            let oFilterModel = this.getView().getModel("FilterModel");

            if (!oFilterModel) {
              oFilterModel = new JSONModel({
                AllType: []
              });

              this.getView().setModel(
                oFilterModel,
                "FilterModel"
              );
            }

            oFilterModel.setProperty("/AllType", aUniqueTypes);

            this.byId("CQ_id_Title").setText(
              this.getText("QuestionsList") +
              " (" + aData.length + ")"
            );

          } catch (oError) {
            MessageToast.show(
              this.getText("loaddataerror")
            );
          } finally {
            this.closeBusyDialog();
          }
        },
        CQ_onCreatePress: function () {

          this.getOwnerComponent().setModel(
            new JSONModel({
              question_text: "",
              test_id: "",
              type: "",
              marks: "",
              options: []
            }),
            "detail"
          );

          this.getOwnerComponent().setModel(
            new JSONModel({
              editMode: true,
              createMode: true
            }),
            "ui"
          );

          this.getRouter().navTo("RouteQuestionDetail");
        },

        // CREATE DIALOG
        // CQ_onCreatePress: async function () {

        //   this.getRouter().navTo("RouteQuestionDetail")
        //   // const oViewModel = this.getView().getModel("questionModel");
        //   // if (!this.QD_oQuestionsDialog) {
        //   //   this.QD_oQuestionsDialog = await this.loadFragment({
        //   //     name: "sap.kt.com.minihrsolution.fragment.CandidateQuestion",
        //   //   });
        //   //   this.getView().addDependent(this.QD_oQuestionsDialog);
        //   // }
        //   // this.QD_oQuestionsDialog.open();
        // },
        onCloseQuestion: function () {

          const oModel = this.getView().getModel("questionModel");

          oModel.setData({
            test_id: "",
            question_text: "",
            marks: "",
            type: "",
            order_no: "",
            options: []
          });

          [
            "testid",
            "idQuestiontext",
            "idmard",
            "idtype",
            "idOrderno"
          ].forEach(function (sId) {
            this.byId(sId).setValueState("None");
          }.bind(this));

          this.QD_oQuestionsDialog.close();
        },
        onDeleteOption: function (oEvent) {

          var oModel = this.getView().getModel("questionModel");
          var aOptions = oModel.getProperty("/options");

          var oContext = oEvent.getSource().getBindingContext("questionModel");
          var sPath = oContext.getPath();
          var iIndex = parseInt(sPath.split("/").pop(), 10);

          aOptions.splice(iIndex, 1);

          oModel.setProperty("/options", aOptions);
        },
        onAfterRendering: function () {
          var oInput = this.byId("idBulkOptionInput");

          if (oInput && !oInput._pasteAttached) {
            oInput.attachBrowserEvent("paste", this.onOptionPaste.bind(this));
            oInput._pasteAttached = true;
          }
        },
        onGenerateOptions: function () {
          var sText = this.byId("idBulkOptionInput").getValue();

          if (!sText) {
            return;
          }
          var aLines = sText.split(/\r?\n/)
            .filter(function (sLine) {
              return sLine.trim() !== "";
            });

          var oModel = this.getView().getModel("questionModel");
          var aOptions = oModel.getProperty("/options") || [];

          aLines.forEach(function (sLine) {
            aOptions.push({
              option_text: sLine.trim(),
              is_correct: "false",
              order_no: aOptions.length + 1
            });
          });

          oModel.setProperty("/options", aOptions);

          this.byId("idBulkOptionInput").setValue("");
        },
        onQuestionchnage: function (oEvent) {
          utils._LCvalidateMandatoryField(oEvent)
        },
        onMarkchange: function (oEvent) {
          var oInput = oEvent.getSource();
          var sValue = oInput.getValue();

          // Allow only 2 digits
          if (sValue.length > 2) {
            sValue = sValue.substring(0, 2);
            oInput.setValue(sValue);
          }
          utils._LCvalidateMandatoryField(oEvent)
        },
        onTypechange: function (oEvent) {
          utils._LCvalidateMandatoryField(oEvent)
        },
        ontestID: function (oEvent) {
          utils._LCvalidateMandatoryField(oEvent)
        },
        onOrderNo: function (oEvent) {
          var oInput = oEvent.getSource();
          var sValue = oInput.getValue();

          // Allow only 2 digits
          if (sValue.length > 2) {
            sValue = sValue.substring(0, 2);
            oInput.setValue(sValue);
            utils._LCvalidateMandatoryField(oEvent)
          }
        },

        onSaveQuestion: async function () {
          try {
            if (
              utils._LCvalidateMandatoryField(this.byId("testid"), "ID") &&
              utils._LCvalidateMandatoryField(this.byId("idQuestiontext"), "ID") &&
              utils._LCvalidateMandatoryField(this.byId("idmard"), "ID") &&
              utils._LCvalidateMandatoryField(this.byId("idtype"), "ID") &&
              utils._LCvalidateMandatoryField(this.byId("idOrderno"), "ID")

            ) { } else {
              MessageToast.show(this.i18nModel.getText("mandetoryFields"));
              return;
            }
            var oModel = this.getView().getModel("questionModel");
            var oData = oModel.getData();
            // At least 2 options required
            if (!oData.options || oData.options.length < 2) {
              MessageToast.show(this.i18nModel.getText("optionvalidation"));
              return;
            }
            var payload = {
              test_id: parseInt(oData.test_id, 10),
              question_text: oData.question_text,
              marks: parseInt(oData.marks, 10),
              order_no: parseInt(oData.order_no, 10),
              type: oData.type,
              options: oData.options.map(function (oOption) {
                return {
                  option_text: oOption.option_text,
                  is_correct: oOption.is_correct === true || oOption.is_correct === "true",
                  order_no: parseInt(oOption.order_no, 10)
                };
              })
            };

            this.getBusyDialog()
            await this.ajaxCreateWithJQuery("QuestionWithOptions", {
              data: payload
            });
            this.closeBusyDialog();
            if (this.QD_oQuestionsDialog) {
              this.QD_oQuestionsDialog.close();
            }
            await this.CQ_loadQuestionsData();

            MessageToast.show("Question created successfully");

          } catch (oError) {
            this.closeBusyDialog();
            MessageBox.error(
              oError.message || "Failed to save question"
            );
          }
        },

        CQ_onCloseUploadDialog: function () {
          // Close dialog
          this.byId("CQ_id_UploadDialog").close();

          // Clear FileUploader UI
          const oFileUploader = this.byId("CQ_id_FileUploader");
          oFileUploader.clear();

          //Clear stored file reference
          this._selectedFile = null;
        },

        CQ_onDownloadExcelPress: function (oEvent) {

          if (!this._oTemplateActionSheet) {

            this._oTemplateActionSheet = new sap.m.ActionSheet({
              buttons: [
                new sap.m.Button({
                  text: "MCQ Template",
                  press: this.onDownloadOMRTemplate.bind(this)
                }),
                new sap.m.Button({
                  text: "Coding Template",
                  press: this.onDownloadCodingTemplate.bind(this)
                })
              ]
            });

            this.getView().addDependent(this._oTemplateActionSheet);
          }

          this._oTemplateActionSheet.openBy(oEvent.getSource());
        },
        onDownloadOMRTemplate: function () {

          var aData = [{
            "Test ID": "",
            "Type": "",
            "Question Text": "",
            "Marks": "",
            "Order No": "",
            "Option 1": "",
            "Option 2": "",
            "Option 3": "",
            "Option 4": "",
            "Correct Option": ""
          }];

          var oSheet = XLSX.utils.json_to_sheet(aData);
          var oBook = XLSX.utils.book_new();

          XLSX.utils.book_append_sheet(
            oBook,
            oSheet,
            "OMR Questions"
          );

          XLSX.writeFile(
            oBook,
            "OMR_Questions_Template.xlsx"
          );
        },
        onDownloadCodingTemplate: function () {

          var aData = [{
            "Test ID": "",
            "Type": "",
            "Title": "",
            "Question Text": "",
            "Marks": "",
            "Order No": "",
            "Difficulty": "",
            "Topic": "",
            "Skill Levels": "",
            "Constraints": "",
            "Allowed Languages": "",
            "Starter Code JS": "",
            "Starter Code Java": "",
            "Starter Code Python": "",
            "Example 1 Input": "",
            "Example 1 Output": "",
            "Example 1 Description": "",
            "Example 2 Input": "",
            "Example 2 Output": "",
            "Example 2 Description": ""
          }];

          var oSheet = XLSX.utils.json_to_sheet(aData);
          var oBook = XLSX.utils.book_new();

          XLSX.utils.book_append_sheet(
            oBook,
            oSheet,
            "Coding Questions"
          );

          XLSX.writeFile(
            oBook,
            "Coding_Questions_Template.xlsx"
          );
        },

        getText: function (sKey, aParams) {
          return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aParams);
        },
        CQ_handleValueChange: function (oEvent) {
          const oFileUploader = this.byId("CQ_id_FileUploader");
          const aFiles = oEvent.getParameter("files"); //  correct way

          if (!aFiles || aFiles.length === 0) {
            MessageToast.show(this.getText("fileRemoved"));
            this._selectedFile = null;
            return;
          }

          //  store file globally in controller
          this._selectedFile = aFiles[0];

          oFileUploader.setValue(this._selectedFile.name);
        },

        CQ_handleUploadPress: function () {

          if (!this._selectedFile) {
            MessageToast.show(this.getText("chooseFileFirst"));
            return;
          }
          const oFile = this._selectedFile;
          const reader = new FileReader();
          reader.onload = async function (e) {
            try {
              this.getBusyDialog();

              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, {
                type: "array"
              });

              const sheet = workbook.Sheets[
                workbook.SheetNames[0]
              ];

              const jsonData = XLSX.utils.sheet_to_json(sheet);
              if (!jsonData || jsonData.length === 0) {
                MessageBox.error("Excel file is empty");
                return;
              }

              const headers = Object.keys(jsonData[0]);

              const aCodingColumns = [
                "Test ID",
                "Type",
                "Title",
                "Question Text",
                "Marks",
                "Order No",
                "Difficulty",
                "Topic",
                "Skill Levels",
                "Constraints",
                "Allowed Languages",
                "Starter Code JS",
                "Starter Code Java",
                "Starter Code Python",
                "Example 1 Input",
                "Example 1 Output",
                "Example 1 Description",
                "Example 2 Input",
                "Example 2 Output",
                "Example 2 Description"
              ];

              const aMCQColumns = [
                "Test ID",
                "Type",
                "Question Text",
                "Marks",
                "Order No",
                "Option 1",
                "Option 2",
                "Option 3",
                "Option 4",
                "Correct Option"
              ];

              const sFirstType = (
                jsonData[0]["Type"] || ""
              ).toString().trim().toLowerCase();

              const aRequiredColumns =
                sFirstType === "coding"
                  ? aCodingColumns
                  : aMCQColumns;

              const aMissingColumns = aRequiredColumns.filter(
                function (sColumn) {
                  return !headers.includes(sColumn);
                }
              );

              if (aMissingColumns.length > 0) {

                MessageBox.error(
                  "Missing Columns:\n\n" +
                  aMissingColumns.join("\n")
                );

                return;
              }

              // Validate rows
              for (let i = 0; i < jsonData.length; i++) {

                const row = jsonData[i];

                const sType = (
                  row["Type"] || ""
                ).toString().trim().toLowerCase();

                if (sType === "coding") {

                  if (
                    !row["Test ID"] ||
                    !row["Title"] ||
                    !row["Question Text"] ||
                    !row["Marks"] ||
                    !row["Order No"]
                  ) {

                    MessageBox.error(
                      "Invalid Coding Record at Row " +
                      (i + 2)
                    );

                    return;
                  }

                } else {

                  if (
                    !row["Test ID"] ||
                    !row["Question Text"] ||
                    !row["Marks"] ||
                    !row["Order No"] ||
                    !row["Option 1"] ||
                    !row["Option 2"] ||
                    !row["Correct Option"]
                  ) {

                    MessageBox.error(
                      "Invalid MCQ Record at Row " +
                      (i + 2)
                    );

                    return;
                  }

                  const iCorrectOption = parseInt(
                    row["Correct Option"],
                    10
                  );

                  if (
                    isNaN(iCorrectOption) ||
                    iCorrectOption < 1 ||
                    iCorrectOption > 4
                  ) {

                    MessageBox.error(
                      "Correct Option must be between 1 and 4 at Row " +
                      (i + 2)
                    );

                    return;
                  }
                }
              }

              // Build all payloads first
              const aPayloads = [];

              jsonData.forEach(function (row) {

                const sType = (row["Type"] || "")
                  .toString()
                  .trim()
                  .toLowerCase();

                let payload = null;

                // ==========================
                // CODING QUESTION
                // ==========================
                if (sType === "coding") {

                  payload = {
                    test_id: parseInt(
                      row["Test ID"],
                      10
                    ),
                    type: "coding",
                    title:
                      row["Title"] || "",
                    question_text:
                      row["Question Text"] || "",
                    marks: parseInt(
                      row["Marks"],
                      10
                    ),
                    order_no: parseInt(
                      row["Order No"],
                      10
                    ),
                    difficulty:
                      row["Difficulty"] || "",
                    topic:
                      row["Topic"] || "",
                    skill_levels:
                      (row["Skill Levels"] || "")
                        .split(",")
                        .map(function (s) {
                          return s.trim();
                        })
                        .filter(Boolean),

                    constraints:
                      (row["Constraints"] || "")
                        .split("|")
                        .map(function (s) {
                          return s.trim();
                        })
                        .filter(Boolean),

                    starter_code: {

                      JavaScript:
                        row["Starter Code JS"] || "",
                      Java:
                        row["Starter Code Java"] || "",
                      Python:
                        row["Starter Code Python"] || ""
                    },

                    allowed_languages:
                      (row["Allowed Languages"] || "").split(",")
                        .map(function (s) {
                          return s.trim();
                        }).filter(Boolean),
                    options: [

                      {
                        option_text: "Example 1",
                        is_correct: false,
                        order_no: 1,
                        note: {
                          input:
                            row["Example 1 Input"] || "",
                          output:
                            row["Example 1 Output"] || "",
                          description:
                            row["Example 1 Description"] || ""
                        }
                      },

                      {
                        option_text: "Example 2",
                        is_correct: false,
                        order_no: 2,

                        note: {
                          input:
                            row["Example 2 Input"] || "",
                          output:
                            row["Example 2 Output"] || "",
                          description:
                            row["Example 2 Description"] || ""
                        }
                      }

                    ].filter(function (oExample) {

                      return (
                        oExample.note.input ||
                        oExample.note.output ||
                        oExample.note.description
                      );

                    })

                  };

                }

                // ==========================
                // MCQ QUESTION
                // ==========================
                else {

                  const iCorrectOption =
                    parseInt(
                      row["Correct Option"],
                      10
                    );

                  payload = {

                    test_id: parseInt(
                      row["Test ID"],
                      10
                    ),

                    type:
                      row["Type"],
                    question_text:
                      row["Question Text"],
                    marks: parseInt(
                      row["Marks"],
                      10
                    ),

                    order_no: parseInt(
                      row["Order No"],
                      10
                    ),
                    options: [

                      {
                        option_text:
                          row["Option 1"] || "",
                        is_correct:
                          iCorrectOption === 1,

                        order_no: 1
                      },

                      {
                        option_text:
                          row["Option 2"] || "",
                        is_correct:
                          iCorrectOption === 2,
                        order_no: 2
                      },

                      {
                        option_text:
                          row["Option 3"] || "",
                        is_correct:
                          iCorrectOption === 3,

                        order_no: 3
                      },

                      {
                        option_text:
                          row["Option 4"] || "",
                        is_correct:
                          iCorrectOption === 4,
                        order_no: 4
                      }

                    ].filter(function (oOption) {
                      return oOption.option_text;
                    })

                  };

                }

                if (
                  payload &&
                  payload.test_id &&
                  payload.question_text
                ) {

                  aPayloads.push(payload);
                }

              });

              if (!aPayloads.length) {
                MessageBox.error("No valid records found.");
                return;
              }

              if (!aPayloads.length) {
                MessageBox.error("No valid records found.");
                return;
              }

              // Single API Call
              const oPayload = {
                data: aPayloads
              };

              await this.ajaxCreateWithJQuery(
                "QuestionWithOptions",
                oPayload
              );

              await this.CQ_loadQuestionsData();

              MessageToast.show(
                aPayloads.length +
                " Questions uploaded successfully"
              );

              this._selectedFile = null;

              if (this.byId("CQ_id_FileUploader")) {
                this.byId("CQ_id_FileUploader").clear();
              }

              if (this.byId("CQ_id_UploadDialog")) {
                this.byId("CQ_id_UploadDialog").close();
              }

              // await this.CQ_loadQuestionsData();

              // MessageToast.show(
              //   "Upload Completed\n" +
              //   "Success: " + successCount +
              //   "\nFailed: " + failedCount
              // );

              // this._selectedFile = null;

              // if (this.byId("CQ_id_FileUploader")) {
              //   this.byId("CQ_id_FileUploader").clear();
              // }

              // if (this.byId("CQ_id_UploadDialog")) {
              //   this.byId("CQ_id_UploadDialog").close();
              // }

            } catch (oError) {
              MessageBox.error(
                oError.message || this.getText("invalidExcel")
              );

            } finally {

              this.closeBusyDialog();
            }

          }.bind(this);

          reader.readAsArrayBuffer(oFile);
        },

        CQ_onGoPress: async function () {
          var sType = this.byId("CQ_id_Department").getSelectedKey();
          var sSearchText = this.byId("CQ_id_Department").getValue().trim();

          await this.CQ_loadQuestionsData(
            sType,
            sSearchText
          );
        },

        CQ_onUploadPress: function () {
          this.byId("CQ_id_UploadDialog").open();
        },

        QD_onDepartmentFilterChange: function (oEvent) {
          const oCombo = oEvent.getSource();
          const sKey = oCombo.getSelectedKey();

          // If user clicks cross (X)
          if (!sKey) {
            // just clear UI
            oCombo.setValue("");
            oCombo.setSelectedKey("");

            // clear view model only
            this.oview.getModel("viewModel").setProperty("/selectedDepartment", "");
            //  DO NOT reload table
            return;
          }
          // If value selected â†’ just store it
          this.oview.getModel("viewModel").setProperty("/selectedDepartment", sKey);
        },

        CQ_onClearPress: function () {
          // Get ComboBox
          const oCombo = this.byId("CQ_id_Department");
          const osearch = this.byId("searchid");
          // Clear UI selection
          oCombo.setSelectedKey("");
          oCombo.setValue("");
          osearch.setValue("");
        },
        QD_setQuestionsModel: function (aData) {
          const oModel = new JSONModel({
            Questions: aData || [],
          });

          this.oview.setModel(oModel, "Questionmodel");
          this.byId("QD_id_Title").setText(
            this.getText("QuestionsList") + " (" + aData.length + ")",
          );
        },

        onPressback: function () {
          this.getRouter().navTo("RouteTilePage");
        },
        onLogout() {
          this.CommonLogoutFunction(); // Navigate to login page
        },
        onpressquestion: function (oEvent) {

          var oQuestion = JSON.parse(JSON.stringify(
            oEvent.getSource()
              .getBindingContext("Questionmodel")
              .getObject()
          ));

          if (oQuestion.options) {

            oQuestion.options.forEach(function (oOption) {

              oOption.is_correct =
                oOption.is_correct === 1 ||
                  oOption.is_correct === "1" ||
                  oOption.is_correct === true
                  ? 1
                  : 0;

            });

          }
          this.getOwnerComponent().setModel(
            new JSONModel({
              editMode: false,
              createMode: false
            }),
            "ui"
          );

          this.getOwnerComponent().setModel(
            new JSONModel(oQuestion),
            "detail"
          );

          this.getRouter().navTo("RouteQuestionDetail");
        },
        onGlobalSearch: function (oEvent) {

          var sQuery = oEvent.getParameter("newValue") || "";
          var oTable = this.byId("CQ_id_Table");

          if (!oTable) {
            return;
          }

          var oBinding = oTable.getBinding("items");

          if (!oBinding) {
            return;
          }

          if (!sQuery) {
            oBinding.filter([]);

            this.byId("CQ_id_Title").setText(
              this.getText("QuestionsList") +
              " (" + oBinding.getLength() + ")"
            );
            return;
          }

          var aFilters = [
            new Filter("question_text", FilterOperator.Contains, sQuery),

            new Filter({
              path: "test_id",
              test: function (vValue) {
                return String(vValue).includes(sQuery);
              }
            })
          ];

          oBinding.filter(
            new Filter({
              filters: aFilters,
              and: false
            })
          );

          // Update count after filtering
          setTimeout(() => {
            this.byId("CQ_id_Title").setText(
              this.getText("QuestionsList") +
              " (" + oBinding.getLength() + ")"
            );
          }, 0);
        },

        CQ_onDeletePress: async function () {

          try {

            var oTable = this.byId("CQ_id_Table");

            var oSelectedItem =
              oTable.getSelectedItem();

            if (!oSelectedItem) {

              sap.m.MessageToast.show(
                "Please select a question"
              );

              return;
            }

            var oData =
              oSelectedItem
                .getBindingContext("Questionmodel")
                .getObject();

            var payload = {

              filters: {
                id: oData.id
              }

            };

            this.showConfirmationDialog(
              "Delete Question",
              "Are you sure you want to delete this question?",
              async function () {

                await this.ajaxDeleteWithJQuery(
                  "QuestionWithOptions",
                  {
                    filters: {
                      id: oData.id
                    }
                  }
                );

                sap.m.MessageToast.show(
                  "Question deleted successfully"
                );

                await this.CQ_loadQuestionsData();
                this.byId("CQ_id_Table").removeSelections(true);
              }.bind(this)
            );

          } catch (oError) {

            sap.m.MessageBox.error(
              oError.message ||
              "Failed to delete question"
            );

          }

        },
        

        CQ_onExcelPress: function (oEvent) {

          if (!this._oExportActionSheet) {

            this._oExportActionSheet = new sap.m.ActionSheet({
              buttons: [
                new sap.m.Button({
                  text: "MCQ Questions",
                  press: this.onDownloadOMRQuestions.bind(this)
                }),
                new sap.m.Button({
                  text: "Coding Questions",
                  press: this.onDownloadCodingQuestions.bind(this)
                })
              ]
            });

            this.getView().addDependent(this._oExportActionSheet);
          }

          this._oExportActionSheet.openBy(oEvent.getSource());
        },
        onDownloadOMRQuestions: function () {

          var aQuestions = this.getView()
            .getModel("Questionmodel")
            .getProperty("/Questions") || [];

          var aOMRQuestions = aQuestions
            .filter(function (oQuestion) {
              return oQuestion.type !== "coding";
            })
            .map(function (oQuestion) {

              return {
                "Test ID": oQuestion.test_id,
                "Type": oQuestion.type,
                "Question Text": oQuestion.question_text,
                "Marks": oQuestion.marks,
                "Order No": oQuestion.order_no,
                "Option 1": oQuestion.options?.[0]?.option_text || "",
                "Option 2": oQuestion.options?.[1]?.option_text || "",
                "Option 3": oQuestion.options?.[2]?.option_text || "",
                "Option 4": oQuestion.options?.[3]?.option_text || "",
                "Correct Option":
                  (oQuestion.options || []).findIndex(
                    o => o.is_correct == 1
                  ) + 1
              };
            });

          var oSheet = XLSX.utils.json_to_sheet(aOMRQuestions);
          var oBook = XLSX.utils.book_new();

          XLSX.utils.book_append_sheet(
            oBook,
            oSheet,
            "MCQ Questions"
          );

          XLSX.writeFile(
            oBook,
            "MCQ_Questions.xlsx"
          );
        },

        onDownloadCodingQuestions: function () {

          try {

            var aQuestions = this.getView()
              .getModel("Questionmodel")
              .getProperty("/Questions") || [];

            var aCodingQuestions = aQuestions
              .filter(function (oQuestion) {
                return oQuestion.type === "coding";
              })
              .map(function (oQuestion) {

                var oExample1 = {};
                var oExample2 = {};
                var oStarterCode = {};
                var aConstraints = [];

                // Example 1
                try {
                  oExample1 = oQuestion.options?.[0]?.note ?
                    JSON.parse(oQuestion.options[0].note) : {};
                } catch (e) {
                  oExample1 = {};
                }

                // Example 2
                try {
                  oExample2 = oQuestion.options?.[1]?.note ?
                    JSON.parse(oQuestion.options[1].note) : {};
                } catch (e) {
                  oExample2 = {};
                }

                // Starter Code
                try {
                  oStarterCode = oQuestion.starter_code ?
                    JSON.parse(oQuestion.starter_code) : {};
                } catch (e) {
                  oStarterCode = {};
                }

                // Constraints
                try {
                  aConstraints = oQuestion.constraints ?
                    JSON.parse(oQuestion.constraints) : [];
                } catch (e) {
                  aConstraints = [];
                }

                return {

                  "Test ID": oQuestion.test_id || "",
                  "Type": oQuestion.type || "",
                  "Title": oQuestion.title || "",
                  "Question Text": oQuestion.question_text || "",
                  "Marks": oQuestion.marks || "",
                  "Order No": oQuestion.order_no || "",
                  "Difficulty": oQuestion.difficulty || "",
                  "Topic": oQuestion.topic || "",

                  "Skill Levels":
                    Array.isArray(oQuestion.skill_levels) ?
                      oQuestion.skill_levels.join(", ") :
                      (oQuestion.skill_levels || ""),

                  "Constraints":
                    Array.isArray(aConstraints) ?
                      aConstraints.join("\n") :
                      "",

                  "Allowed Languages":
                    Array.isArray(oQuestion.allowed_languages) ?
                      oQuestion.allowed_languages.join(", ") :
                      (oQuestion.allowed_languages || ""),

                  "Starter Code JS":
                    oStarterCode.JavaScript || "",

                  "Starter Code Java":
                    oStarterCode.Java || "",

                  "Starter Code Python":
                    oStarterCode.Python || "",

                  "Example 1 Input":
                    oExample1.input || "",

                  "Example 1 Output":
                    oExample1.output || "",

                  "Example 1 Description":
                    oExample1.description || "",

                  "Example 2 Input":
                    oExample2.input || "",

                  "Example 2 Output":
                    oExample2.output || "",

                  "Example 2 Description":
                    oExample2.description || ""

                };

              });

            var oWorksheet = XLSX.utils.json_to_sheet(aCodingQuestions);

            var oWorkbook = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(
              oWorkbook,
              oWorksheet,
              "Coding Questions"
            );

            XLSX.writeFile(
              oWorkbook,
              "Coding_Questions.xlsx"
            );

            MessageToast.show("Coding questions exported successfully");

          } catch (oError) {

            console.error(oError);

            MessageBox.error(
              "Failed to export coding questions"
            );

          }

        },

      },


    );
  },
);