sap.ui.define(
  ["./BaseController", "sap/ui/model/json/JSONModel", "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator","sap/m/MessageToast"],
  function (BaseController, JSONModel, Filter, FilterOperator, MessageToast) {
    "use strict";
    return BaseController.extend(
      "sap.kt.com.minihrsolution.controller.HiringDashboardOverview",
      {
        onInit: function () {
          this.getRouter()
            .getRoute("RouteHiringDashboardOverview")
            .attachMatched(this._onRouteMatched, this);
          this._iLimit = 11;
          this._iCurrentPage = 1;
          this._bLoading = false;
        },
        // Fetches ONE page from the server.
        // bAppend = false -> initial load (page 1, replaces model)
        // bAppend = true  -> "More" click (next page, appended to model)
        loadCandidates: async function (bAppend) {
          if (this._bLoading) {
            return;
          }
          this._bLoading = true;
          this.getBusyDialog();

          try {
            if (!bAppend) {
              this._iCurrentPage = 1;
            } else {
              this._iCurrentPage += 1;
            }

            var oResponse = await this.ajaxCreateWithJQuery(
              "getDashboardCandidates",
              { page: this._iCurrentPage, limit: this._iLimit }
            );

            var aNewData = oResponse.data || [];
            aNewData.sort(function (a, b) {
              return b.id - a.id;
            });
            aNewData.forEach(function (oCandidate) {
              if (oCandidate.submittedDate) {
                oCandidate.submittedDate =
                  new Date(oCandidate.submittedDate).toLocaleDateString("en-GB");
              }
            });

            if (!bAppend) {
              var oModel = new JSONModel({
                Candidates: aNewData,
                Count: oResponse.pagination.total,
                FilteredCount: aNewData.length
              });
              oModel.setSizeLimit(10000); // avoid JSONModel's default 100-item binding cap
              this.getView().setModel(oModel, "CandidateModel");
              this._oOriginalCandidates = aNewData;
            } else {
              var oExistingModel = this.getView().getModel("CandidateModel");
              var aExisting = oExistingModel.getProperty("/Candidates") || [];
              var aCombined = aExisting.concat(aNewData);

              oExistingModel.setProperty("/Candidates", aCombined);
              oExistingModel.setProperty("/FilteredCount", aCombined.length);
              this._oOriginalCandidates = aCombined;
            }
          } catch (e) {
            console.error(e);
            // roll back page counter on failure so a retry re-fetches the same page
            if (bAppend) {
              this._iCurrentPage -= 1;
            }
          } finally {
            this.closeBusyDialog();
            this._bLoading = false;
          }
        },
        HD_onPressPassFailPie: function () {
          this.getView().getModel("ChartTypeModel").setProperty("/passFailType", "pie");
        },
        HD_onPressPassFailDonut: function () {
          this.getView().getModel("ChartTypeModel").setProperty("/passFailType", "donut");
        },
        HD_onPressPassFailBar: function () {
          this.getView().getModel("ChartTypeModel").setProperty("/passFailType", "bar");
        },

        HD_onPressSkillColumn: function () {
          this.getView().getModel("ChartTypeModel").setProperty("/skillLevelType", "column");
        },
        HD_onPressSkillBar: function () {
          this.getView().getModel("ChartTypeModel").setProperty("/skillLevelType", "bar");
        },

        HD_onPressTestLine: function () {
          this.getView().getModel("ChartTypeModel").setProperty("/testCompletedType", "line");
        },
        HD_onPressTestColumn: function () {
          this.getView().getModel("ChartTypeModel").setProperty("/testCompletedType", "column");
        },

        HD_onPressMcqCodingDonut: function () {
          this.getView().getModel("ChartTypeModel").setProperty("/mcqCodingType", "donut");
        },
        HD_onPressMcqCodingPie: function () {
          this.getView().getModel("ChartTypeModel").setProperty("/mcqCodingType", "pie");
        },

        _onRouteMatched: async function () {
          const isValid = await this.commonLoginFunction("Expense");
          if (!isValid) return;
     this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
     this.byId("MI_id_B").setVisible(false);
     this.byId("MI_id_Bu").setVisible(false);
     this.byId("MI_id_Btn_Pass").setVisible(false);
          this.getBusyDialog();

          try {
            var oSummaryResponse = await this.ajaxCreateWithJQuery(
              "getDashboardSummary", {}
            );

            var oChartResponse = await this.ajaxCreateWithJQuery(
              "getDashboardCharts", {}
            );

            var oDashboardData = oSummaryResponse?.data || oSummaryResponse || {};
            this.getView().setModel(
              new JSONModel(oDashboardData),
              "DashboardModel"
            );

            // Only page 1 (10 rows) loads here — NOT all data
            await this.loadCandidates(false);

            var oCharts = oChartResponse.data;

            this.getView().setModel(
              new JSONModel({
                PassFail: [
                  { Result: "Pass", Count: oCharts.passFailPie.pass },
                  { Result: "Fail", Count: oCharts.passFailPie.fail },
                  { Result: "In Progress", Count: oCharts.passFailPie.inProgress },
                  { Result: "Not Started", Count: oCharts.passFailPie.notStarted }
                ],

                SkillLevel: oCharts.skillLevelBar.map(function (item) {
                  return { Skill: item.label, Count: item.total };
                }),

                TestCompleted: oCharts.testsOverTime.map(function (item) {
                  return { Day: item.date, Count: item.mcqCompleted + item.codingCompleted };
                }),

                McqCoding: [
                  { Type: "MCQ Submitted", Count: oCharts.mcqVsCodingDonut.mcqSubmitted },
                  { Type: "MCQ Pending", Count: oCharts.mcqVsCodingDonut.mcqPending },
                  { Type: "Coding Submitted", Count: oCharts.mcqVsCodingDonut.codingSubmitted },
                  { Type: "Coding Pending", Count: oCharts.mcqVsCodingDonut.codingPending }
                ]
              }),
              "ChartModel"
            );

            this.getView().setModel(
              new JSONModel({
                passFailType: "pie",
                skillLevelType: "column",
                testCompletedType: "line",
                mcqCodingType: "donut"
              }),
              "ChartTypeModel"
            );

          } catch (oError) {
            console.error(oError);
          } finally {
            this.closeBusyDialog();
          }
        },

        onUpdateFinished: async function (oEvent) {
          var sReason = oEvent.getParameter("reason");

          if (sReason !== "Growing") {
            return;
          }

          if (this._bLoading) {
            return;
          }

          var oModel = this.getView().getModel("CandidateModel");
          var iLoaded = (oModel.getProperty("/Candidates") || []).length;
          var iTotal = oModel.getProperty("/Count");

          if (iLoaded < iTotal) {
            await this.loadCandidates(true);
          }
        },

        onViewCandidate: async function (oEvent) {
          var oContext = oEvent
            .getSource()
            .getParent()
            .getBindingContext("CandidateModel");
          var oSelectedData = oContext.getObject();
          this.getBusyDialog();
          try {
            var oDetailResponse = await this.ajaxCreateWithJQuery(
              "getCandidateDetail",
              { id: oSelectedData.id }
            );

            if (this._oStudentDialog) {
              this._oStudentDialog.destroy();
              this._oStudentDialog = null;
            }

            this._oStudentDialog = await this.loadFragment({
              name: "sap.kt.com.minihrsolution.fragment.StudentDetails",
            });

            this.getView().addDependent(this._oStudentDialog);

            var d = oDetailResponse?.data || oDetailResponse || {};
            var mcq = d.mcqTest || {};
            var coding = d.codingTest || {};

            var aRaw = mcq.questionBreakdown || [];
            var oSeen = {};
            var aQuestions = [];
            aRaw.forEach(function (oQ) {
              var sKey = String(oQ.question_id);
              if (!oSeen[sKey]) {
                oSeen[sKey] = true;
                aQuestions.push({
                  order_no: oQ.order_no,
                  question_id: oQ.question_id,
                  question_text: oQ.question_text || "",
                  marks: oQ.marks ?? 1,
                  selected_option_text: oQ.selected_option_text || "",
                  correct_option_text: oQ.correct_option_text || "",
                  marks_awarded: oQ.marks_awarded ?? 0,
                  status: oQ.status || "Skipped",
                });
              }
            });

            var oModel = new JSONModel({
              id: d.candidate?.id || "",
              student_Id: d.candidate?.student_Id || "",
              candidate_Name: d.candidate?.candidate_Name || "",
              candidate_Email: d.candidate?.candidate_Email || "",
              skill_level: d.candidate?.skill_level || "",
              preferred_language: d.candidate?.preferred_language || "",
              photo: d.candidate?.photo || "",
              created_at: d.candidate?.created_at
                ? new Date(d.candidate.created_at).toLocaleString()
                : "",

              mcqScore: mcq.score ?? 0,
              mcqStatus: mcq.status || "Not Started",
              mcqResult: mcq.result_status || "Result Pending",
              mcqTotalMarks: mcq.total_marks ?? 0,
              mcqTimeTaken: mcq.timeTakenMins ?? 0,
              mcqStartedAt: mcq.started_at
                ? new Date(mcq.started_at).toLocaleString()
                : "Test Not Started",
              mcqSubmittedAt: mcq.submitted_at
                ? new Date(mcq.submitted_at).toLocaleString()
                : "Not Submitted",
              totalQuestions: mcq.totalQuestions ?? 0,
              correctAnswers: mcq.correctAnswers ?? 0,
              wrongAnswers: mcq.incorrectAnswers ?? 0,

              questionBreakdown: aQuestions,

              codingScore: coding.score ?? 0,
              codingStatus: coding.status || "Not Started",
              codingResult: coding.result_status || "Result Pending",
              codingTotalMarks: coding.total_marks ?? 0,
              codingTimeTaken: coding.timeTakenMins ?? 0,
              codingStartedAt: coding.started_at
                ? new Date(coding.started_at).toLocaleString()
                : "Coding Test Not Started",
              codingSubmittedAt: coding.submitted_at
                ? new Date(coding.submitted_at).toLocaleString()
                : "Code Not Submitted",
              submittedLanguage:
                coding.submittedLanguage ||
                d.candidate?.preferred_language ||
                "Language Not Specified",
              aiScore: coding.ai_score ?? 0,

              codingSubmissions: (coding.submissions || []).map(function (s, i) {
                return {
                  index: i + 1,
                  answer_id: s.answer_id,
                  question_id: s.question_id,
                  submittedLanguage: s.submittedLanguage || "Language Not Specified ",
                  submittedCode: s.submittedCode || "No code submitted yet.",
                  ai_score: s.ai_score ?? 0,
                  detailedFeedback: s.detailedFeedback || "",
                };
              }),

              overallScore: d.overallScore ?? 0,
              overallResult: d.overallResult || "In Progress",
              totalMarks: (mcq.total_marks ?? 0) + (coding.total_marks ?? 0),
            });

            oModel.setSizeLimit(10000);

            this._oStudentDialog.setModel(oModel, "studentModel");

            this._oStudentDialog.open();
          } catch (oError) {
            console.error(oError);
          } finally {
            this.closeBusyDialog();
          }
        },

        onMcqFilterChange: function (oEvent) {
          var sKey = oEvent.getParameter("item").getKey();
          var oTable = null;
          var oCountText = null;

          if (this._oStudentDialog) {
            this._oStudentDialog.getContent()[0]
              .findAggregatedObjects(true, function (oControl) {
                if (
                  oControl.isA("sap.m.Table") &&
                  oControl.getId().endsWith("mcqBreakdownTable")
                ) {
                  oTable = oControl;
                }
                if (
                  oControl.isA("sap.m.Text") &&
                  oControl.getId().endsWith("mcqFilterCount")
                ) {
                  oCountText = oControl;
                }
              });
          }

          if (!oTable) {
            console.warn("mcqBreakdownTable not found in dialog");
            return;
          }

          var oBinding = oTable.getBinding("items");

          if (sKey === "All") {
            oBinding.filter([]);
          } else {
            oBinding.filter([
              new Filter("status", FilterOperator.EQ, sKey)
            ]);
          }

          if (oCountText) {
            var iCount = oBinding.getLength();
            oCountText.setText(iCount + " question" + (iCount !== 1 ? "s" : ""));
          }
        },

        onCandidateLiveSearch: function (oEvent) {
          var sValue = (oEvent.getParameter("newValue") || "")
            .toLowerCase()
            .trim();

          var oTable = this.byId("HDO_id_CandidateTable");
          var oBinding = oTable.getBinding("items");
          var oModel = this.getView().getModel("CandidateModel");

          if (!sValue) {
            oBinding.filter([]);

            var iTotal = oModel.getProperty("/Candidates").length;
            oModel.setProperty("/FilteredCount", iTotal);
            oModel.setProperty("/Count", iTotal);

            return;
          }

          var oFilter = new Filter({
            path: "",
            test: function (oData) {
              return (
                String(oData.student_Id || "").toLowerCase().includes(sValue) ||
                String(oData.candidate_Name || "").toLowerCase().includes(sValue) ||
                String(oData.candidate_Email || "").toLowerCase().includes(sValue) ||
                String(oData.overallResult || "").toLowerCase().includes(sValue) ||
                String(oData.status || "").toLowerCase().includes(sValue)
              );
            }
          });

          oBinding.filter([oFilter]);

          setTimeout(function () {
            oModel.setProperty("/FilteredCount", oBinding.getLength());
            oModel.setProperty("/Count", oBinding.getLength());
          }, 0);
        },

        onCloseStudentDialog: function () {
          if (this._oStudentDialog) {
            this._oStudentDialog.close();
          }
        },

        HDO_onPress: function () {
          this.getRouter().navTo("RouteHiringDashboard");
        },
       MI_onPressButtons: function (oEvent) {

    const actionText = oEvent.getSource().getText();
    const i18n = this.getView().getModel("i18n").getResourceBundle();

    const dialogTexts = {
        "Selected": "selecttitle",
        "Rejected": "rejecttitle"
    };

    // Get all selected candidates
    var oTable = this.byId("HDO_id_CandidateTable");
    var aSelectedItems = oTable.getSelectedItems();

    if (aSelectedItems.length === 0) {
        sap.m.MessageToast.show("Please select at least one candidate.");
        return;
    }

    // Extract email IDs
    var sEmails = aSelectedItems
        .map(function (oItem) {
            return oItem.getBindingContext("CandidateModel").getObject().candidate_Email;
        })
        .join(",");

    this._selectedEmails = sEmails; // Optional: save for later

    this.getText = actionText;
    this.functionToOpenDialog(actionText, i18n.getText(dialogTexts[actionText]));
},
   
    functionToOpenDialog(text, oDialogTitle) {
  const oView = this.getView();

  if (!this.oDialog) {
    sap.ui.core.Fragment.load({
      name: "sap.kt.com.minihrsolution.fragment.Selected",
      controller: this
    }).then(function (oDialog) {
      this.oDialog = oDialog;
      oView.addDependent(oDialog);
      oDialog.open();
      this.valueSetFunction(text, oDialogTitle);
    }.bind(this));
  } else {
    // Dialog already exists: just open it and reset values
    this.oDialog.open();
    this.valueSetFunction(text, oDialogTitle);
  }
},
 MTF_onPressOk: function () {

    var oTable = this.byId("HDO_id_CandidateTable");
    var aSelectedItems = oTable.getSelectedItems();

    if (aSelectedItems.length === 0) {
        sap.m.MessageToast.show("Please select at least one candidate.");
        return;
    }

    var oRemark = sap.ui.getCore().byId("MIF_id_remark1");
    var sRemark = oRemark.getValue().trim();

    // Validate Remark
    if (!sRemark) {
        oRemark.setValueState(sap.ui.core.ValueState.Error);
        oRemark.setValueStateText("Please enter remarks.");
        oRemark.focus();
        return;
    }

    oRemark.setValueState(sap.ui.core.ValueState.None);

    var sRemark = sap.ui.getCore().byId("MIF_id_remark1").getValue().trim();

    var sStatus = this.getText === "Selected" ? "Selected" : "Rejected";

    // Collect IDs and Email IDs
    var aIds = [];
    var aEmails = [];

    aSelectedItems.forEach(function (oItem) {
        var oData = oItem.getBindingContext("CandidateModel").getObject();

        aIds.push(oData.id); // Replace with your ID property if different
        aEmails.push(oData.candidate_Email); // Replace with your email property if different
    });

    var oPayload = {
        filters: {
            id: aIds
        },
        data: {
            candidate_Emails: aEmails,
            Comment: sRemark,
            Status: sStatus
        }
    };
this.getBusyDialog();
    this.ajaxUpdateWithJQuery("Candidatemail", oPayload)
        .then(function (oResponse) {
this.closeBusyDialog();
            sap.m.MessageToast.show(oResponse.message || "Updated successfully.");
            this.loadCandidates()
            this.oDialog.close();
            oTable.removeSelections(true);

            this.byId("MI_id_B").setVisible(false);
            this.byId("MI_id_Bu").setVisible(false);
            this.byId("MI_id_Btn_Pass").setVisible(false);



        }.bind(this))
        .catch(function (oError) {
this.closeBusyDialog();
            sap.m.MessageBox.error(
                oError.responseJSON?.message ||
                oError.responseText ||
                "Update failed."
            );

        });
},
    //  MIF_onPressClose() {
    //   this.byId("MI_id_B").setVisible(false);
    //   this.byId("MI_id_Bu").setVisible(false);
    //   var oTable = this.byId("HDO_id_CandidateTable");
    //   oTable.removeSelections(true);
    //   this.oDialog.close();
     

    //   // this.onBeforeShow();
    // },
    MIF_onPressClose() {
  this.byId("MI_id_B").setVisible(false);
  this.byId("MI_id_Bu").setVisible(false);
  this.byId("MI_id_Btn_Pass").setVisible(false);

  var oTable = this.byId("HDO_id_CandidateTable");
  oTable.removeSelections(true);

  if (this.oDialog) {
    this.oDialog.close();
  }

  // Reset fields
  sap.ui.getCore().byId("MIF_id_remark1").setValue("");
  sap.ui.getCore().byId("MIF_id_Email1").setValue("");
  sap.ui.getCore().byId("MIF_id_remark1").setValueState("None");
},
   valueSetFunction: function (text, oDialogTitle) {

    sap.ui.getCore().byId("MIF_id_OkBtn1").setText(text);

    const i18n = this.getView().getModel("i18n").getResourceBundle();

    sap.ui.getCore().byId("MIF_id_RemarkLabel1")
        .setText(i18n.getText("managerRemarksLeave"));
        sap.ui.getCore().byId("MIF_id_Email1").setValue(this._selectedEmails || "");

    sap.ui.getCore().byId("MIF_id_remark1").setValue("");
    sap.ui.getCore().byId("MIF_id_DialogManRemark1").setTitle(oDialogTitle);
    sap.ui.getCore().byId("MIF_id_remark1").setValueState("None");

    // var bShowEmail = (text === "Selected" || text === "Rejected");

    // sap.ui.getCore().byId("MIF_id_EmailLabel1").setVisible(bShowEmail);
    // sap.ui.getCore().byId("MIF_id_Email1").setVisible(bShowEmail);

    // if (!bShowEmail) {
    //     sap.ui.getCore().byId("MIF_id_Email1").setValue("");
    // }
},
   onCandidateSelectionChange: function (oEvent) {
          var oTable = this.byId("HDO_id_CandidateTable");
          var aSelectedItems = oTable.getSelectedItems();

          // Store the selected row data
          this.bSelected = aSelectedItems.map(function (oItem) {
            return oItem.getBindingContext("CandidateModel").getObject();
          });

          this.byId("MI_id_B").setVisible(this.bSelected.length > 0);
          this.byId("MI_id_Bu").setVisible(this.bSelected.length > 0);
          this.byId("MI_id_Btn_Pass").setVisible(this.bSelected.length > 0);
        },
 onStatusPress: function (oEvent) {

    var oContext = oEvent.getSource().getBindingContext("CandidateModel");
    var oData = oContext.getObject();

    sap.m.MessageBox.information(
        oData.comment || "No comments available.",
        {
            title: "Manager Comment"
        }
    );
},

        onLogout: function () {
          this.CommonLogoutFunction();
        },
        MI_onPressPassCandidate: function () {
          this.getBusyDialog();

          var aSelectedData = this.bSelected;

          var aPayload = aSelectedData.map(function (oData) {
            return {
              filters: {id: oData.mcq.attempt_id},
              data: {result_status: "Pass"}
            };
          });
          Promise.all(aPayload.map(function (requestData) { return this.ajaxUpdateWithJQuery("TestAttempt", requestData) }.bind(this)))
            .then(function () {
              this.loadCandidates()
              MessageToast.show("Candidate(s) passed successfully.");
              
              this.byId("HDO_id_CandidateTable").removeSelections(true);
              
              // Hide buttons
              this.byId("MI_id_B").setVisible(false);
              this.byId("MI_id_Bu").setVisible(false);
              this.byId("MI_id_Btn_Pass").setVisible(false);
              this.closeBusyDialog();

            }.bind(this))
            .catch(function (error) {
              this.closeBusyDialog();
              MessageToast.show(error.message || error.responseText || "Failed to update candidate status.");
            }.bind(this));
        },
      }
    );
  }
);