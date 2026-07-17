/**
 * Shared favicon asset for the dashboard.
 *
 * Exported once so it can back both the inline `data:` URI in the HTML head
 * (instant, no extra request) and a real `/favicon.ico` route on the server.
 * Browsers request `/favicon.ico` directly regardless of any `<link>` tag
 * (bookmarks, pinned tabs, history, tab groups); without a route for it that
 * request 404s and some of those surfaces never show an icon.
 */
export const FAVICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAQHRFWHRTb2Z0d2FyZQBSZWFsRmF2aWNvbkdlbmVyYXRvciAoaHR0cHM6Ly9yZWFsZmF2aWNvbmdlbmVyYXRvci5uZXQpmZlW4QAAApBJREFUeJzt3D2PDWEAxfG/t1gvEYWst0YkIihspZCNRKMWqg3RSUhUfAHVhih8Aauk1eg0SyU0IgqFgmiVCBuueZJbuss+M3fPvXNOcdqZs+c3mezcezMMBgMSXeQF3CMv4B55AffIC7hHXsA98gLukRdwj7yAe+QF3CMv4B55AffIC7hHXsA98gLukRdwj7yAe+QF3CMv4B55gbH9YbAB2ALsAPYDJ4FzwAVgVt2vdwDDwbcBe4HLwFtgMCJn1X3XHQC4BlyvzK5/DH8CuAm8XmV0e4Bf/znO33JoxDF3N1f9XeA98HsNxwtAGwBgY7mPA+8qjxeAWgBgprniF4CvLY4XgBYAV4AvLY4VgFoAYA740XL8ANQAAEeBjx2MH4CKHAHur/E/nQB0CHCxw6s/ABV51OHVH4CKfO9w/ABMQAIQAA+Acs5PwDPgIXCvKXJ71GdLAajPT+AD8BJYbAafBw4AW8unpeqR+wzwrXk6fgLcGD6ozagHdQIo458v3xVM+lXeN4AV4DlwUD2eK8Byud2oh3MFWBl+/Ti1t5xpBijjX1UP5gzwAtipHswVoHwQd6tPt55pA/hcHq7UYzkDvAL2qcdyBngKbFKP5QywqB7KHeCSeih3gDPqodwB5tRDuQMcVw/lDnBMPZQ7wGH1UO4AE/MdbgB6lgAEIAABCEAAAhCAAAQgAAEIQAACEIAAdAMAbC4/5mqR7eP+LVLfAU4Dj1vkTnkHUQDqARZanLPkzWrvKgpAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAATCLAA2CpMnsqz3mqxTmXhm/XGus7iNYNIAnAREZewD3yAu6RF3CPvIB75AXcIy/gHnkB98gLuEdewD1/AHnx1UA5qJJIAAAAAElFTkSuQmCC';

export const FAVICON_PNG_BUFFER = Buffer.from(FAVICON_PNG_BASE64, 'base64');
