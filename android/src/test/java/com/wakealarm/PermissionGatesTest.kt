package com.wakealarm

import org.junit.Assert.assertEquals
import org.junit.Test

class PermissionGatesTest {
  @Test fun backgroundPopupIsUndeterminedOnRomsWithVendorSwitches() {
    for (m in listOf("Xiaomi", "vivo", "OPPO", "realme")) {
      assertEquals(m, PermissionGates.NOT_DETERMINED, PermissionGates.backgroundPopup(m))
    }
  }

  @Test fun backgroundPopupIsNotApplicableElsewhere() {
    for (m in listOf("samsung", "Google", "motorola", "OnePlus", "")) {
      assertEquals(m, PermissionGates.NOT_APPLICABLE, PermissionGates.backgroundPopup(m))
    }
  }

  @Test fun subBrandsReportThroughTheParentManufacturerString() {
    // POCO and Redmi ship Build.MANUFACTURER "Xiaomi"; iQOO ships "vivo".
    assertEquals(PermissionGates.NOT_DETERMINED, PermissionGates.backgroundPopup("Xiaomi"))
    assertEquals(PermissionGates.NOT_DETERMINED, PermissionGates.backgroundPopup("vivo"))
  }
}
