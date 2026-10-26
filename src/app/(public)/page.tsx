import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>FinanceSight</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Dashboard publik dengan data sintesis akan tampil di sini.
        </CardContent>
      </Card>
    </main>
  );
}