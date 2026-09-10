<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Tests;

use PHPUnit\Framework\TestCase;
use WebSanity\FormSanity\Form;
use WebSanity\FormSanity\Unknown;

final class FormTest extends TestCase
{
	private const MARKUP = '<!DOCTYPE html><form data-fs-form action="/x"><input name="email" type="text" data-fs-type="email" required data-fs-unique="/api/unique"><select name="color"><option value="">c</option><option value="Other">Other</option></select><input name="other" type="text" required data-fs-relevant="color == \'Other\'"><input type="hidden" name="csrf" value="tok"></form>';

	public function testAnAcceptableSubmission(): void
	{
		$result = Form::parse(self::MARKUP)->validate(['email' => 'jans@websanity.com', 'color' => '', 'csrf' => 'tok']);
		self::assertTrue($result->isValid());
		self::assertSame(200, $result->httpStatus());
	}

	public function testTheWorstVerdictAndTheFirstCodeInOrder(): void
	{
		$result = Form::parse(self::MARKUP)->validate(['email' => 'jans@web']);
		self::assertSame([['field' => 'email', 'code' => 'type.email']], array_map(fn ($e) => ['field' => $e['field'], 'code' => $e['code']], $result->errors()));
		self::assertNotSame('', $result->errors()[0]['message']);
	}

	public function testAnIrrelevantFieldIsInertAndANonEmptyValueForItIsRejected(): void
	{
		$form = Form::parse(self::MARKUP);
		self::assertTrue($form->validate(['email' => 'jans@websanity.com', 'color' => '', 'other' => ''])->isValid());
		$result = $form->validate(['email' => 'jans@websanity.com', 'color' => '', 'other' => 'teal']);
		self::assertSame('relevance', $result->errors()[0]['code']);
		self::assertSame('other', $result->errors()[0]['field']);
		$result = $form->validate(['email' => 'jans@websanity.com', 'color' => 'Other', 'other' => '']);
		self::assertSame('required', $result->errors()[0]['code']);
	}

	public function testAValueNamingAnIrrelevantMemberIsRejected(): void
	{
		$markup = '<!DOCTYPE html><form data-fs-form action="/x"><input type="radio" name="m" value="S"><input type="radio" name="m" value="T"><input type="radio" name="j" value="Print" data-fs-relevant="m == \'S\'"><input type="radio" name="j" value="Online"></form>';
		$result = Form::parse($markup)->validate(['m' => ['T'], 'j' => ['Print']]);
		self::assertSame([['j', 'relevance']], array_map(fn ($e) => [$e['field'], $e['code']], $result->errors()));
	}

	public function testUnknownFieldsIgnoreAndReject(): void
	{
		$form = Form::parse(self::MARKUP);
		$payload = ['email' => 'jans@websanity.com', 'token' => 'abc', 'probe' => '1'];
		self::assertTrue($form->validate($payload)->isValid());
		$result = $form->validate($payload, [], null, Unknown::Reject, ['token']);
		self::assertFalse($result->isValid());
		self::assertNull($result->errors()[0]['field']);
		self::assertTrue($form->validate(['email' => 'jans@websanity.com', 'token' => 'abc'], [], null, Unknown::Reject, ['token'])->isValid());
	}

	public function testUniquenessRunsLastAndOnlyOnAValueThatSurvived(): void
	{
		$form = Form::parse(self::MARKUP);
		$asked = [];
		$unique = function (string $field, string $value) use (&$asked): bool { $asked[] = [$field, $value]; return false; };
		$result = $form->validate(['email' => 'jans@websanity.com'], [], $unique);
		self::assertSame([['email', 'jans@websanity.com']], $asked);
		self::assertSame('unique', $result->errors()[0]['code']);
		$asked = [];
		$form->validate(['email' => 'jans@web'], [], $unique);
		self::assertSame([], $asked);
	}

	public function testAllFailuresAreReportedInFieldOrderWithFormLevelLast(): void
	{
		$markup = '<!DOCTYPE html><form data-fs-form action="/x"><input name="a" type="text" required><input name="b" type="text" required></form>';
		$result = Form::parse($markup)->validate(['zzz' => '1'], [], null, Unknown::Reject);
		self::assertSame(['a', 'b', null], array_map(fn ($e) => $e['field'], $result->errors()));
	}

	public function testRejectReportsOneFormLevelErrorWithoutEchoingKeys(): void
	{
		$result = Form::parse(self::MARKUP)->validate(['email' => 'jans@websanity.com', 'p1' => '1', 'p2' => '2'], [], null, Unknown::Reject);
		self::assertCount(1, $result->errors());
		self::assertNull($result->errors()[0]['field']);
		self::assertSame('x-unknown-field', $result->errors()[0]['code']);
		self::assertStringNotContainsString('p1', $result->errors()[0]['message']);
	}

	public function testAJsonBodyCarryingAFileFieldIsAnInvalidResult(): void
	{
		$markup = '<!DOCTYPE html><form data-fs-form action="/x"><input name="att" type="file"></form>';
		$result = Form::parse($markup)->validate(['att' => 'gotcha']);
		self::assertFalse($result->isValid());
		self::assertSame(422, $result->httpStatus());
		self::assertSame('x-malformed-body', $result->errors()[0]['code']);
	}
}
