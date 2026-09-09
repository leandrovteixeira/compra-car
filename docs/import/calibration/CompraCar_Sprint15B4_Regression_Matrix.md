# Compra-Car --- Sprint 15B.4 Regression Matrix

**Paired baseline:** Handbook v0.3 + Prompt v0.2

  -----------------------------------------------------------------------------------------------
  Brand   Case               Result          Expected normative behavior           Status
  ------- ------------------ --------------- ------------------------------------- --------------
  Jeep    Retail vs VD       PASS            VD/VD-CPF excluded; Retail preserved. No regression
          isolation                                                                

  Jeep    PY/MY atomicity    PASS            Explicit pairs remain separate        No regression
                                             products.                             

  Jeep    Trade-In vs        PASS            Other brands ≠ Jeep-to-Jeep.          No regression
          Loyalty                                                                  

  Jeep    Stock-specific     PASS            Preserve distinct Offers; stock age   No regression
          condition                          not canonical blocker.                

  BYD     Non-cumulative OR  PASS            Dolphin GS alternatives remain        No regression
                                             separate Offers.                      

  BYD     Same-brand used    PASS            Seminovo BYD → loyalty_bonus.         No regression
          vehicle                                                                  

  BYD     Balloon financing  PASS/DECISION   Preserve balloon;                     Known decision
                                             BALLOON_UNSTRUCTURED; valuation       
                                             review if unsupported.                

  BYD     Explicit PPS       PASS            Explicit PPS may populate             No regression
                                             public_price_amount.                  

  Geely   First installment  PASS            Mechanism maps to invoice_discount    Recalibrated
          benefit                            when rules require equivalent NF      
                                             reduction.                            

  Geely   Missing PY/MY      PASS/DECISION   Do not infer; operator assigns before Recalibrated
                                             Apply.                                

  Geely   Wallbox/recharge   PASS            Composition preserved as alternatives No regression
          alternatives                       where stated.                         

  VW      Regional source    PASS            Normalize national; preserve source   Recalibrated
                                             geography; SP reference when needed.  

  VW      Dealer             PASS            Manufacturer/dealer/customer benefit  No regression
          participation                      separated; no double count.           

  VW      Hyphen + dealer    PASS            Positive dealer contribution still    No regression
          rebate                             materializes Policy.                  

  VW      Package            PASS/DECISION   Preserve package codes; operator      Recalibrated
          restriction                        decision if unresolved.               

  VW      Retail vs NF same  PASS            Semantic types remain distinct.       No regression
          amount                                                                   

  GAC     Geometry/version   PASS            Conditions stay with correct visual   New golden
          ownership                          columns/versions.                     

  GAC     Retail + Direct    PASS            Direct Sales excluded despite         New golden
          Sales same page                    proximity.                            

  GAC     Dealer             PASS            17K + 3K Rede keeps funding split and New golden
          participation                      total customer benefit.               

  GAC     Wallbox            PASS            Commercial-benefit context →          Corrected
          accompanies                        free_wallbox; R\$4k valuation.        
          vehicle                                                                  

  GWM     2-of-3 composition PASS            Finance+Trade-In OR                   New golden
                                             Insurance+Trade-In OR                 
                                             Finance+Insurance.                    

  GWM     Selective dealer   PASS            Dealer rebate only on eligible        New golden
          participation                      Trade-In/compositions.                

  GWM     Bonus in NF        PASS            R\$15k/R\$20k na NF →                 New golden
                                             invoice_discount.                     

  GWM     Prior-letter       PASS/DECISION   No reconstruction;                    New golden
          extension                          EXTERNAL_DOCUMENT_DEPENDENCY.         
  -----------------------------------------------------------------------------------------------

## Gate result

-   Material semantic regressions: **0**
-   Explicit operator-decision classes retained: **4**
    -   balloon/residual not structurally valued;
    -   missing PY/MY;
    -   unresolved package/option eligibility;
    -   external-document dependency.
-   Cross-brand calibrated manufacturers: **6**
    -   Jeep
    -   BYD
    -   Geely
    -   Volkswagen
    -   GAC
    -   GWM

## Decision

The semantic calibration layer is sufficiently stable to freeze for the
MVP and move to Sprint 15C.

The freeze does **not** mean every commercial letter can be applied
without review. It means unresolved long-tail cases must surface as
explicit Issues/Operator Decisions instead of silent inference.

## Next implementation boundary

`XLSX Upload → Contract Parser → Structural Validator → Product Resolution → Operator Decisions → Preview`

No commercial database write in the first 15C increment.
